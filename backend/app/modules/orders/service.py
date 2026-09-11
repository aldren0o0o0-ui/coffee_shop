import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.rate_limit import check_order_creation_rate_limit
from app.modules.customers import service as customers_service
from app.modules.customers.models import Customer
from app.modules.inventory.service import (
    InsufficientStockError,
    deduct_inventory_for_order,
)
from app.modules.menu.models import (
    MenuItem,
    MenuItemAddon,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.orders.models import (
    Order,
    OrderChannel,
    OrderEvent,
    OrderItem,
    OrderItemAddon,
    OrderStatus,
    OrderType,
)
from app.modules.orders.schemas import (
    CustomerOrderCreateRequest,
    OrderItemCreate,
    POSOrderCreateRequest,
)
from app.modules.payments import service as payments_service
from app.modules.payments.schemas import (
    CustomerPaymentRequest,
    PayAtCounterRequest,
)
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """Normalize database timestamps returned without timezone information."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def expire_stale_orders(database: Session) -> int:
    """
    Finds and marks all awaiting_payment orders that have passed expires_at as EXPIRED.
    Increments customer no_show_count for abuse detection.
    """
    now = utc_now()
    statement = (
        select(Order)
        .options(selectinload(Order.customer))
        .where(
            Order.order_status == OrderStatus.AWAITING_PAYMENT,
            Order.expires_at.is_not(None),
            Order.expires_at < now,
        )
    )
    stale_orders = list(database.scalars(statement).all())
    count = len(stale_orders)
    if count > 0:
        for order in stale_orders:
            order.order_status = OrderStatus.EXPIRED
            database.add(
                OrderEvent(
                    order_id=order.order_id,
                    previous_status=OrderStatus.AWAITING_PAYMENT,
                    new_status=OrderStatus.EXPIRED,
                    user_id=None,
                    created_at=now,
                    metadata_json='{"source": "expiry_sweep"}',
                )
            )
            if order.customer:
                customers_service.record_customer_no_show(database, order.customer)
        database.commit()
        logger.info(f"Sweep job: Expired {count} stale unpaid orders.")
    return count


def generate_unique_reference_code(database: Session) -> str:
    """
    Generates a unique reference code (e.g. REF-4821) for pay_at_counter reservations.
    """
    for attempt in range(5):
        random_digits = f"{random.randint(1000, 9999)}"
        code = f"REF-{random_digits}"
        existing = database.scalar(
            select(Order.order_id)
            .where(
                Order.reference_code == code,
                Order.order_status == OrderStatus.AWAITING_PAYMENT,
            )
            .limit(1)
        )
        if existing is None:
            return code
    return f"REF-{random.randint(10000, 99999)}"


def generate_unique_pickup_code(database: Session) -> str:
    """
    Generates a unique 2-letter + 4-digit pickup code (e.g. BF-4892) scoped to today's orders.
    Retries up to 5 times on collision.
    """
    today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    for attempt in range(5):
        random_digits = f"{random.randint(1000, 9999)}"
        code = f"BF-{random_digits}"

        existing = database.scalar(
            select(Order.order_id)
            .where(
                Order.pickup_code == code,
                Order.order_date >= today_start,
            )
            .limit(1)
        )

        if existing is None:
            return code

    # Fallback to 6-digit code if 4-digit code space is crowded today
    random_digits = f"{random.randint(100000, 999999)}"
    logger.warning("Pickup code collision fallback to 6 digits triggered.")
    return f"BF-{random_digits}"


def create_customer_order(
    database: Session,
    payload: CustomerOrderCreateRequest,
    client_ip: str | None,
) -> Order:
    # 1. Rate Limiting Check
    if not check_order_creation_rate_limit(client_ip, payload.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You have submitted multiple order requests recently. Please wait a few moments before trying again.",
        )

    # 2. Resolve Customer Identity
    existing_customer = customers_service.resolve_customer(
        database=database,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone_number=payload.phone_number,
        is_guest=True,
    )

    # 3. Check Abuse / Blocked Customer
    customers_service.ensure_customer_can_order(existing_customer)

    # 4. Calculate Order Pricing & Validate Items
    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item_data in payload.items:
        menu_item = database.get(MenuItem, item_data.menu_item_id)
        if not menu_item or not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected menu item is currently unavailable.",
            )

        unit_price = menu_item.base_price

        # Check Size Adjustment
        if item_data.menu_item_size_id:
            size_obj = database.get(MenuItemSize, item_data.menu_item_size_id)
            if not size_obj or size_obj.menu_item_id != menu_item.menu_item_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid drink size specified for {menu_item.item_name}.",
                )
            unit_price += size_obj.price_adjustment

        item_subtotal = unit_price * item_data.quantity

        # Check Addons
        addons_to_create = []
        for addon_data in item_data.addons:
            addon_obj = database.get(MenuItemAddon, addon_data.menu_item_addon_id)
            if not addon_obj or addon_obj.menu_item_id != menu_item.menu_item_id or not addon_obj.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One of the selected customizations is unavailable.",
                )
            addon_subtotal = addon_obj.additional_price * addon_data.quantity
            item_subtotal += addon_subtotal
            addons_to_create.append((addon_obj, addon_data.quantity))

        subtotal += item_subtotal
        order_items_to_create.append({
            "menu_item": menu_item,
            "size_id": item_data.menu_item_size_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "subtotal": item_subtotal,
            "special_instructions": item_data.special_instructions,
            "addons": addons_to_create,
        })

    tax_rate = Decimal("0.08")  # 8% Sales tax
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    now = utc_now()
    is_pay_at_counter = payload.payment_method_intent == "pay_at_counter"
    if is_pay_at_counter:
        expires_at = now + timedelta(days=1)  # 24-hour (1 day) reservation for store visit
        reference_code = generate_unique_reference_code(database)
    else:
        expires_at = now + timedelta(minutes=10)  # 10-minute hold for online checkout
        reference_code = None

    # 5. Create Order in AWAITING_PAYMENT status
    order = Order(
        customer_id=existing_customer.customer_id,
        order_channel=OrderChannel.ONLINE,
        order_status=OrderStatus.AWAITING_PAYMENT,
        order_type=payload.order_type,
        payment_method_intent=payload.payment_method_intent,
        reference_code=reference_code,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        order_date=now,
        expires_at=expires_at,
    )
    database.add(order)
    database.flush()

    for item_dict in order_items_to_create:
        order_item = OrderItem(
            order_id=order.order_id,
            menu_item_id=item_dict["menu_item"].menu_item_id,
            menu_item_size_id=item_dict["size_id"],
            quantity=item_dict["quantity"],
            unit_price=item_dict["unit_price"],
            subtotal=item_dict["subtotal"],
            special_instructions=item_dict["special_instructions"],
        )
        database.add(order_item)
        database.flush()

        for addon_obj, addon_qty in item_dict["addons"]:
            order_item_addon = OrderItemAddon(
                order_item_id=order_item.order_item_id,
                menu_item_addon_id=addon_obj.menu_item_addon_id,
                quantity=addon_qty,
                unit_price=addon_obj.additional_price,
            )
            database.add(order_item_addon)

    database.add(
        OrderEvent(
            order_id=order.order_id,
            previous_status=None,
            new_status=OrderStatus.AWAITING_PAYMENT,
            user_id=None,
            created_at=now,
            metadata_json='{"source": "customer_order"}',
        )
    )

    database.commit()
    database.refresh(order)

    if is_pay_at_counter and existing_customer and existing_customer.email:
        try:
            from app.shared.email_service import send_counter_order_confirmation_email
            send_counter_order_confirmation_email(order, existing_customer.email, run_async=True)
        except Exception as exc:
            logger.error(f"Failed to dispatch counter order email for #{order.order_id}: {exc}")

    return order


def process_order_payment(
    database: Session,
    order_id: int,
    payment_data: CustomerPaymentRequest,
    client_ip: str | None,
) -> Order:
    return payments_service.process_customer_payment(
        database=database,
        order_id=order_id,
        payment_data=payment_data,
        client_ip=client_ip,
    )


VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.AWAITING_PAYMENT: {OrderStatus.CANCELLED, OrderStatus.EXPIRED},
    OrderStatus.CONFIRMED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.READY, OrderStatus.CANCELLED},
    OrderStatus.READY: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: set(),  # Terminal state
    OrderStatus.CANCELLED: set(),  # Terminal state
    OrderStatus.EXPIRED: set(),  # Terminal state
}


def update_order_status(
    database: Session,
    order_id: int,
    new_status: OrderStatus,
    current_user: User,
    metadata: str | dict | None = None,
) -> Order:
    statement = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.events),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(Order.order_id == order_id)
    )
    order = database.scalar(statement)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # Role validation - Allowlist authorized operational roles
    user_roles = [r.role.role_name.lower() for r in current_user.user_roles if r.is_active and r.role.is_active]
    allowed_roles = {"owner", "manager", "cashier", "barista"}
    if not (set(user_roles) & allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update order status.",
        )

    if new_status == order.order_status:
        return order

    # State transition validation
    valid_targets = VALID_TRANSITIONS.get(order.order_status, set())
    if new_status not in valid_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition order from '{order.order_status.value}' to '{new_status.value}'.",
        )

    is_barista = "barista" in user_roles
    is_manager_or_owner = "manager" in user_roles or "owner" in user_roles
    is_cashier = "cashier" in user_roles

    if is_barista and not (is_manager_or_owner or is_cashier):
        if new_status not in [OrderStatus.PREPARING, OrderStatus.READY]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Baristas can only update orders to Preparing or Ready status.",
            )

    previous_status = order.order_status
    order.order_status = new_status
    if new_status == OrderStatus.COMPLETED:
        order.picked_up_at = utc_now()

    meta_str = None
    if metadata is not None:
        if isinstance(metadata, dict):
            import json
            meta_str = json.dumps(metadata)
        else:
            meta_str = str(metadata)

    # Order-event implementation immediately after validated status update and before commit
    event = OrderEvent(
        order_id=order.order_id,
        previous_status=previous_status,
        new_status=new_status,
        user_id=current_user.user_id if current_user else None,
        created_at=utc_now(),
        metadata_json=meta_str,
    )
    database.add(event)

    database.commit()
    database.refresh(order)
    return order


def get_order_for_tracking(
    database: Session,
    order_id: int,
    email: str,
) -> Order:
    """
    Secure tracking query: Must match BOTH order_id and customer email.
    Returns generic 404 on mismatch to prevent ID enumeration.
    """
    normalized_email = email.strip().lower()

    statement = (
        select(Order)
        .join(Order.customer)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(
            Order.order_id == order_id,
            func.lower(Customer.email) == normalized_email,
        )
    )
    order = database.scalar(statement)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="We couldn't find that order. Please check your order number and email address.",
        )

    # Lazy check for expiry if still unpaid
    if (
        order.order_status == OrderStatus.AWAITING_PAYMENT
        and order.expires_at
        and as_utc(order.expires_at) < utc_now()
    ):
        previous_status = order.order_status
        order.order_status = OrderStatus.EXPIRED
        event = OrderEvent(
            order_id=order.order_id,
            previous_status=previous_status,
            new_status=OrderStatus.EXPIRED,
            user_id=None,
            created_at=utc_now(),
            metadata_json='{"reason": "tracking_lazy_expiry"}',
        )
        database.add(event)
        database.commit()

    return order


def create_pos_order(
    database: Session,
    staff_user: User,
    payload: POSOrderCreateRequest,
) -> Order:
    """
    In-store POS register order with immediate payment confirmation.
    """
    # 1. Customer linkage
    customer = None
    if payload.customer_email:
        customer = customers_service.resolve_customer(
            database=database,
            first_name=payload.customer_name,
            email=payload.customer_email,
            is_guest=True,
        )

    # 2. Calculate Pricing
    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item_data in payload.items:
        menu_item = database.scalar(
            select(MenuItem)
            .options(
                selectinload(MenuItem.ingredients)
                .selectinload(MenuItemIngredient.inventory_item)
            )
            .where(MenuItem.menu_item_id == item_data.menu_item_id)
        )
        if not menu_item or not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Menu item is unavailable.",
            )

        unit_price = menu_item.base_price
        if item_data.menu_item_size_id:
            size_obj = database.get(MenuItemSize, item_data.menu_item_size_id)
            if size_obj:
                unit_price += size_obj.price_adjustment

        item_subtotal = unit_price * item_data.quantity

        addons_to_create = []
        for addon_data in item_data.addons:
            addon_obj = database.get(MenuItemAddon, addon_data.menu_item_addon_id)
            if addon_obj and addon_obj.is_active:
                addon_subtotal = addon_obj.additional_price * addon_data.quantity
                item_subtotal += addon_subtotal
                addons_to_create.append((addon_obj, addon_data.quantity))

        subtotal += item_subtotal
        order_items_to_create.append({
            "menu_item": menu_item,
            "size_id": item_data.menu_item_size_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "subtotal": item_subtotal,
            "special_instructions": item_data.special_instructions,
            "addons": addons_to_create,
        })

    tax_rate = Decimal("0.08")
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    now = utc_now()
    pickup_code = generate_unique_pickup_code(database)

    order = Order(
        customer_id=customer.customer_id if customer else None,
        user_id=staff_user.user_id,
        order_channel=OrderChannel.IN_STORE,
        order_status=OrderStatus.CONFIRMED,
        order_type=payload.order_type,
        pickup_code=pickup_code,
        pickup_code_expires_at=now + timedelta(hours=4),
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        order_date=now,
    )
    database.add(order)
    database.flush()

    created_order_items = []
    for item_dict in order_items_to_create:
        order_item = OrderItem(
            order_id=order.order_id,
            menu_item_id=item_dict["menu_item"].menu_item_id,
            menu_item_size_id=item_dict["size_id"],
            quantity=item_dict["quantity"],
            unit_price=item_dict["unit_price"],
            subtotal=item_dict["subtotal"],
            special_instructions=item_dict["special_instructions"],
        )
        database.add(order_item)
        database.flush()
        created_order_items.append(order_item)

        for addon_obj, addon_qty in item_dict["addons"]:
            order_item_addon = OrderItemAddon(
                order_item_id=order_item.order_item_id,
                menu_item_addon_id=addon_obj.menu_item_addon_id,
                quantity=addon_qty,
                unit_price=addon_obj.additional_price,
            )
            database.add(order_item_addon)

    # Deduct inventory atomically (with row locks in PK order)
    try:
        deduct_inventory_for_order(
            database=database,
            order_items=created_order_items,
            order_id=order.order_id,
            created_by_user_id=staff_user.user_id,
            now=now,
            reference_type="order",
            note_prefix="POS Order",
        )
    except InsufficientStockError as err:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete POS sale: '{err.item_name}' is out of stock (needed {err.needed}, available {err.available}).",
        )

    # Record Payment via Payments domain
    payments_service.create_pos_payment(
        database=database,
        order=order,
        payment_method=payload.payment_method,
        total_amount=total_amount,
        amount_tendered=payload.amount_tendered,
        now=now,
    )

    database.add(
        OrderEvent(
            order_id=order.order_id,
            previous_status=None,
            new_status=OrderStatus.CONFIRMED,
            user_id=staff_user.user_id,
            created_at=now,
            metadata_json='{"source": "pos_order"}',
        )
    )

    database.commit()
    database.refresh(order)
    return order


def lookup_pending_counter_order(
    database: Session,
    search_query: str = "",
) -> list[Order]:
    """
    Finds active AWAITING_PAYMENT counter orders by reference code, customer email, or name.
    If search_query is empty, returns all active awaiting payment counter orders.
    Scoped strictly to: order_status == AWAITING_PAYMENT, payment_method_intent == 'pay_at_counter', and expires_at > now.
    """
    now = utc_now()
    q = (search_query or "").strip().lower()

    conditions = [
        Order.order_status == OrderStatus.AWAITING_PAYMENT,
        Order.payment_method_intent == "pay_at_counter",
        Order.expires_at > now,
    ]

    if q:
        conditions.append(
            or_(
                func.lower(Order.reference_code) == q,
                func.lower(Order.reference_code) == f"ref-{q}",
                func.lower(Customer.email) == q,
                func.lower(Customer.first_name).ilike(f"%{q}%"),
                func.lower(Customer.last_name).ilike(f"%{q}%"),
            )
        )

    stmt = (
        select(Order)
        .outerjoin(Order.customer)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(*conditions)
        .order_by(Order.order_date.desc())
    )
    return list(database.scalars(stmt).all())


def pay_pending_counter_order(
    database: Session,
    order_id: int,
    payload: PayAtCounterRequest,
    cashier_user: User,
) -> Order:
    return payments_service.process_pay_at_counter(
        database=database,
        order_id=order_id,
        payload=payload,
        cashier_user=cashier_user,
    )


def update_order_items_and_totals(
    database: Session,
    order: Order,
    items: list[OrderItemCreate],
    order_type: OrderType | None = None,
) -> None:
    if order.order_status != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit items for order in '{order.order_status.value}' status.",
        )

    if order_type:
        order.order_type = order_type

    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item_data in items:
        menu_item = database.get(MenuItem, item_data.menu_item_id)
        if not menu_item or not menu_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected menu item is currently unavailable.",
            )

        unit_price = menu_item.base_price

        if item_data.menu_item_size_id:
            size_obj = database.get(MenuItemSize, item_data.menu_item_size_id)
            if not size_obj or size_obj.menu_item_id != menu_item.menu_item_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid drink size specified for {menu_item.item_name}.",
                )
            unit_price += size_obj.price_adjustment

        item_subtotal = unit_price * item_data.quantity

        addons_to_create = []
        for addon_data in item_data.addons:
            addon_obj = database.get(MenuItemAddon, addon_data.menu_item_addon_id)
            if not addon_obj or addon_obj.menu_item_id != menu_item.menu_item_id or not addon_obj.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One of the selected customizations is unavailable.",
                )
            addon_subtotal = addon_obj.additional_price * addon_data.quantity
            item_subtotal += addon_subtotal
            addons_to_create.append((addon_obj, addon_data.quantity))

        subtotal += item_subtotal
        order_items_to_create.append({
            "menu_item": menu_item,
            "size_id": item_data.menu_item_size_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "subtotal": item_subtotal,
            "special_instructions": item_data.special_instructions,
            "addons": addons_to_create,
        })

    tax_rate = Decimal("0.08")  # 8% Sales tax
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    # Delete existing items and add-ons
    for oi in list(order.order_items):
        for oia in list(oi.addons):
            database.delete(oia)
        database.delete(oi)
    database.flush()

    # Re-create items and add-ons
    for item_dict in order_items_to_create:
        order_item = OrderItem(
            order_id=order.order_id,
            menu_item_id=item_dict["menu_item"].menu_item_id,
            menu_item_size_id=item_dict["size_id"],
            quantity=item_dict["quantity"],
            unit_price=item_dict["unit_price"],
            subtotal=item_dict["subtotal"],
            special_instructions=item_dict["special_instructions"],
        )
        database.add(order_item)
        database.flush()

        for addon_obj, addon_qty in item_dict["addons"]:
            order_item_addon = OrderItemAddon(
                order_item_id=order_item.order_item_id,
                menu_item_addon_id=addon_obj.menu_item_addon_id,
                quantity=addon_qty,
                unit_price=addon_obj.additional_price,
            )
            database.add(order_item_addon)

    order.subtotal = subtotal
    order.tax_amount = tax_amount
    order.total_amount = total_amount
    database.flush()


def update_pending_order(
    database: Session,
    order_id: int,
    items: list[OrderItemCreate],
    order_type: OrderType | None,
    cashier_user: User,
) -> Order:
    stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(Order.order_id == order_id)
    )
    order = database.scalar(stmt)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    update_order_items_and_totals(database, order, items, order_type)
    database.commit()
    database.refresh(order)
    return order


def get_all_orders(
    database: Session,
    limit: int = 50,
) -> list[Order]:
    stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.payments),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .order_by(Order.order_date.desc())
        .limit(limit)
    )
    return list(database.scalars(stmt).all())
