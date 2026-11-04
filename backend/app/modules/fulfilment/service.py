from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.customers.models import Customer
from app.modules.fulfilment.schemas import (
    FulfilmentQueueResponse,
    FulfilmentQueueTicket,
    FulfilmentTicketItem,
    PickupBoardResponse,
    PickupBoardTicket,
    ReorderItemSummary,
    ReorderResponse,
)
from app.modules.menu.models import (
    MenuItem,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderItemAddon,
    OrderStatus,
)

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def estimate_preparation_time(items_count: int, queue_position: int) -> int:
    """
    Configurable prep-time heuristic:
    - Base prep time: 4 minutes
    - Plus 2 minutes per beverage item in this order
    - Plus 3 minutes per order ahead in queue
    """
    base_mins = 4
    item_mins = items_count * 2
    queue_mins = max(queue_position - 1, 0) * 3
    return base_mins + item_mins + queue_mins


def get_fulfilment_queue(
    database: Session,
    branch_id: int | None = None,
) -> FulfilmentQueueResponse:
    """
    Returns prioritized barista preparation queue with live elapsed timers and estimated prep times.
    """
    now = utc_now()
    filters = [
        Order.order_status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY])
    ]
    if branch_id is not None and hasattr(Order, "branch_id"):
        filters.append(Order.branch_id == branch_id)

    stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(*filters)
        .order_by(
            # PREPARING tickets first, then CONFIRMED by oldest order_date, READY at counter last
            (Order.order_status == OrderStatus.PREPARING).desc(),
            (Order.order_status == OrderStatus.CONFIRMED).desc(),
            Order.order_date.asc(),
        )
    )

    orders = list(database.scalars(stmt).all())
    tickets: list[FulfilmentQueueTicket] = []
    total_wait = 0
    active_in_prep_or_confirmed = 0

    for idx, o in enumerate(orders):
        order_date = o.order_date
        if order_date.tzinfo is None:
            order_date = order_date.replace(tzinfo=timezone.utc)

        elapsed = max(int((now - order_date).total_seconds() / 60), 0)
        total_items_qty = sum(oi.quantity for oi in o.order_items)

        if o.order_status in [OrderStatus.CONFIRMED, OrderStatus.PREPARING]:
            active_in_prep_or_confirmed += 1
            est_prep = estimate_preparation_time(total_items_qty, active_in_prep_or_confirmed)
            total_wait += elapsed
        else:
            est_prep = 0

        ticket_items: list[FulfilmentTicketItem] = []
        for oi in o.order_items:
            addons_list = [
                a.menu_item_addon.addon_name
                for a in oi.addons
                if a.menu_item_addon
            ]
            ticket_items.append(
                FulfilmentTicketItem(
                    menu_item_id=oi.menu_item_id,
                    item_name=oi.menu_item.item_name if oi.menu_item else "Coffee Item",
                    size_name=oi.menu_item_size.size_name if oi.menu_item_size else None,
                    quantity=oi.quantity,
                    special_instructions=oi.special_instructions,
                    addons=addons_list,
                )
            )

        customer_name = (
            f"{o.customer.first_name} {o.customer.last_name or ''}".strip()
            if o.customer and o.customer.first_name
            else "Guest Customer"
        )

        tickets.append(
            FulfilmentQueueTicket(
                order_id=o.order_id,
                customer_name=customer_name,
                order_channel=o.order_channel.value,
                order_type=o.order_type.value,
                order_status=o.order_status.value,
                pickup_code=o.pickup_code,
                order_date=order_date,
                elapsed_minutes=elapsed,
                estimated_prep_minutes=est_prep,
                priority_rank=idx + 1,
                items=ticket_items,
            )
        )

    avg_wait = round(total_wait / max(active_in_prep_or_confirmed, 1), 1)
    queue_drain = active_in_prep_or_confirmed * 4

    return FulfilmentQueueResponse(
        tickets=tickets,
        active_count=len(tickets),
        average_wait_minutes=avg_wait,
        estimated_queue_drain_minutes=queue_drain,
    )


def get_public_pickup_board(
    database: Session,
    branch_id: int | None = None,
) -> PickupBoardResponse:
    """
    Public customer-facing pickup display.
    Exposes only pickup code and safe status to preserve customer privacy.
    """
    now = utc_now()
    filters = [
        Order.order_status.in_([OrderStatus.PREPARING, OrderStatus.READY]),
        Order.pickup_code.is_not(None),
    ]
    if branch_id is not None and hasattr(Order, "branch_id"):
        filters.append(Order.branch_id == branch_id)

    stmt = (
        select(Order)
        .where(*filters)
        .order_by(Order.order_date.asc())
    )
    orders = list(database.scalars(stmt).all())

    preparing_list: list[PickupBoardTicket] = []
    ready_list: list[PickupBoardTicket] = []

    for o in orders:
        if not o.pickup_code:
            continue

        if o.order_status == OrderStatus.PREPARING:
            preparing_list.append(
                PickupBoardTicket(
                    pickup_code=o.pickup_code,
                    order_status="preparing",
                    display_status="Brewing on Bar",
                )
            )
        elif o.order_status == OrderStatus.READY:
            ready_since = None
            if o.updated_at:
                upd = o.updated_at if o.updated_at.tzinfo else o.updated_at.replace(tzinfo=timezone.utc)
                ready_since = max(int((now - upd).total_seconds() / 60), 0)

            ready_list.append(
                PickupBoardTicket(
                    pickup_code=o.pickup_code,
                    order_status="ready",
                    display_status="Ready for Pickup",
                    ready_since_minutes=ready_since,
                )
            )

    return PickupBoardResponse(
        preparing=preparing_list,
        ready=ready_list,
        last_updated=now,
    )


def validate_and_prepare_reorder(
    database: Session,
    order_id: int,
    customer_email: str,
) -> ReorderResponse:
    """
    Validates that items in a previous order are still on the active menu,
    checks that drink sizes & add-ons are active, and checks inventory availability.
    """
    normalized_email = customer_email.strip().lower()

    stmt = (
        select(Order)
        .join(Order.customer)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item).selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(
            Order.order_id == order_id,
            func.lower(Customer.email) == normalized_email,
        )
    )
    order = database.scalar(stmt)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found for the specified email address.",
        )

    items_summary: list[ReorderItemSummary] = []
    unavailable_reasons: list[str] = []
    subtotal = Decimal("0.00")

    for oi in order.order_items:
        menu_item = oi.menu_item
        if not menu_item or not menu_item.is_available:
            unavailable_reasons.append(f"'{oi.menu_item.item_name if oi.menu_item else 'Item'}' is currently out of season or unavailable.")
            items_summary.append(
                ReorderItemSummary(
                    menu_item_id=oi.menu_item_id,
                    item_name=oi.menu_item.item_name if oi.menu_item else "Unknown Item",
                    quantity=oi.quantity,
                    unit_price=Decimal("0.00"),
                    subtotal=Decimal("0.00"),
                    is_available=False,
                    stock_status="unavailable",
                )
            )
            continue

        unit_price = menu_item.base_price
        size_name = None
        is_item_available = True

        if oi.menu_item_size_id:
            size = database.get(MenuItemSize, oi.menu_item_size_id)
            if size and size.menu_item_id == menu_item.menu_item_id:
                unit_price += size.price_adjustment
                size_name = size.size_name
            else:
                is_item_available = False
                unavailable_reasons.append(f"Selected size for '{menu_item.item_name}' is no longer offered.")

        item_subtotal = unit_price * oi.quantity

        for addon in oi.addons:
            if addon.menu_item_addon and addon.menu_item_addon.is_active:
                item_subtotal += addon.menu_item_addon.additional_price * addon.quantity
            else:
                is_item_available = False
                unavailable_reasons.append(f"Customization '{addon.menu_item_addon.addon_name if addon.menu_item_addon else 'Addon'}' is currently inactive.")

        # Check ingredient stock
        stock_status = "in_stock"
        for ing in menu_item.ingredients:
            if ing.inventory_item:
                needed = ing.quantity_required * oi.quantity
                if ing.inventory_item.quantity_on_hand < needed:
                    stock_status = "low_stock"
                    is_item_available = False
                    unavailable_reasons.append(f"Ingredient '{ing.inventory_item.item_name}' has insufficient stock for reorder.")

        subtotal += item_subtotal
        items_summary.append(
            ReorderItemSummary(
                menu_item_id=menu_item.menu_item_id,
                item_name=menu_item.item_name,
                size_name=size_name,
                quantity=oi.quantity,
                unit_price=unit_price,
                subtotal=item_subtotal,
                is_available=is_item_available,
                stock_status=stock_status,
            )
        )

    tax_rate = Decimal("0.08")
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount
    can_reorder = len(unavailable_reasons) == 0

    return ReorderResponse(
        original_order_id=order.order_id,
        items=items_summary,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        can_reorder=can_reorder,
        unavailable_reasons=unavailable_reasons,
    )
