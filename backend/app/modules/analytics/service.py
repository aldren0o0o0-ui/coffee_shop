from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.customers.models import Customer
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.menu.models import (
    MenuItem,
    MenuItemAddon,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderItemAddon,
    OrderStatus,
)
from app.modules.payments.models import Payment, PaymentStatus
from app.modules.procurement.models import (
    PurchaseRequest,
    PurchaseRequestStatus,
)
from app.modules.users.models import User, UserRole
from app.modules.analytics.schemas import (
    BaristaDashboardStats,
    BaristaTicket,
    BaristaTicketItem,
    CashierDashboardStats,
    ChannelSales,
    CombinedDashboardResponse,
    InventoryStaffDashboardStats,
    InventoryTransactionInfo,
    LowStockItemInfo,
    ManagerDashboardStats,
    OwnerDashboardStats,
    PaymentMethodSales,
    RecentOrderInfo,
    ShiftTeamMember,
    StoreReportResponse,
    TimelinePoint,
    TopSellingItem,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_today_start() -> datetime:
    return utc_now().replace(hour=0, minute=0, second=0, microsecond=0)


def get_owner_dashboard_stats(database: Session) -> OwnerDashboardStats:
    today_start = get_today_start()

    # Revenue
    revenue_stmt = (
        select(func.coalesce(func.sum(Order.total_amount), Decimal("0.00")))
        .where(
            Order.order_date >= today_start,
            Order.order_status.in_([
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.COMPLETED,
            ]),
        )
    )
    today_revenue = database.scalar(revenue_stmt) or Decimal("0.00")

    # Order counts
    total_orders_stmt = select(func.count(Order.order_id)).where(Order.order_date >= today_start)
    today_orders_count = database.scalar(total_orders_stmt) or 0

    completed_orders_stmt = select(func.count(Order.order_id)).where(
        Order.order_date >= today_start,
        Order.order_status == OrderStatus.COMPLETED,
    )
    completed_orders_count = database.scalar(completed_orders_stmt) or 0

    # Active staff
    active_staff_stmt = select(func.count(User.user_id)).where(User.is_active.is_(True))
    active_staff_count = database.scalar(active_staff_stmt) or 0

    # Low stock items
    low_stock_stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
    )
    low_stock_rows = list(database.scalars(low_stock_stmt).all())
    low_stock_count = len(low_stock_rows)

    low_stock_items = [
        LowStockItemInfo(
            inventory_item_id=item.inventory_item_id,
            item_name=item.item_name,
            unit_of_measure=item.unit_of_measure,
            quantity_on_hand=item.quantity_on_hand,
            reorder_level=item.reorder_level,
            unit_cost=item.unit_cost,
            is_critical=item.quantity_on_hand <= (item.reorder_level * Decimal("0.5")),
        )
        for item in low_stock_rows
    ]

    # Recent orders
    recent_orders_stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
        )
        .order_by(Order.order_date.desc())
        .limit(5)
    )
    recent_order_rows = list(database.scalars(recent_orders_stmt).all())

    recent_orders = []
    for o in recent_order_rows:
        customer_name = (
            f"{o.customer.first_name} {o.customer.last_name or ''}".strip()
            if o.customer and o.customer.first_name
            else "Guest Customer"
        )
        items_summary = ", ".join(
            f"{oi.quantity}x {oi.menu_item.item_name}" for oi in o.order_items
        ) or "No items"

        recent_orders.append(
            RecentOrderInfo(
                order_id=o.order_id,
                customer_name=customer_name,
                order_channel=o.order_channel,
                order_status=o.order_status,
                total_amount=o.total_amount,
                order_date=o.order_date,
                pickup_code=o.pickup_code,
                items_summary=items_summary,
            )
        )

    return OwnerDashboardStats(
        today_revenue=today_revenue,
        today_orders_count=today_orders_count,
        completed_orders_count=completed_orders_count,
        active_staff_count=active_staff_count,
        low_stock_count=low_stock_count,
        recent_orders=recent_orders,
        low_stock_items=low_stock_items,
    )


def get_manager_dashboard_stats(database: Session) -> ManagerDashboardStats:
    today_start = get_today_start()
    now = utc_now()

    # Revenue today
    revenue_stmt = (
        select(func.coalesce(func.sum(Order.total_amount), Decimal("0.00")))
        .where(
            Order.order_date >= today_start,
            Order.order_status.in_([
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.COMPLETED,
            ]),
        )
    )
    shift_revenue = database.scalar(revenue_stmt) or Decimal("0.00")

    # Order velocity
    total_orders_stmt = select(func.count(Order.order_id)).where(Order.order_date >= today_start)
    orders_count = database.scalar(total_orders_stmt) or 0
    hours_elapsed = max((now - today_start).total_seconds() / 3600.0, 1.0)
    orders_per_hour = round(orders_count / hours_elapsed, 1)

    # Pending purchase requests
    pending_purchases_stmt = select(func.count(PurchaseRequest.purchase_request_id)).where(
        PurchaseRequest.request_status.in_([
            PurchaseRequestStatus.DRAFT,
            PurchaseRequestStatus.SUBMITTED,
        ])
    )
    pending_purchases_count = database.scalar(pending_purchases_stmt) or 0

    # Team members
    team_stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role)
        )
        .where(User.is_active.is_(True))
    )
    team_users = list(database.scalars(team_stmt).unique())

    shift_team = [
        ShiftTeamMember(
            user_id=u.user_id,
            full_name=f"{u.first_name} {u.last_name}",
            username=u.username,
            role_name=u.user_roles[0].role.role_name if u.user_roles else "Staff",
            last_login_at=u.last_login_at,
        )
        for u in team_users
    ]

    # Low stock
    low_stock_stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
    )
    low_stock_rows = list(database.scalars(low_stock_stmt).all())
    low_stock_items = [
        LowStockItemInfo(
            inventory_item_id=item.inventory_item_id,
            item_name=item.item_name,
            unit_of_measure=item.unit_of_measure,
            quantity_on_hand=item.quantity_on_hand,
            reorder_level=item.reorder_level,
            unit_cost=item.unit_cost,
            is_critical=item.quantity_on_hand <= (item.reorder_level * Decimal("0.5")),
        )
        for item in low_stock_rows
    ]

    # Recent orders
    recent_orders_stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
        )
        .order_by(Order.order_date.desc())
        .limit(5)
    )
    recent_orders = [
        RecentOrderInfo(
            order_id=o.order_id,
            customer_name=f"{o.customer.first_name} {o.customer.last_name or ''}".strip() if o.customer else "Guest",
            order_channel=o.order_channel,
            order_status=o.order_status,
            total_amount=o.total_amount,
            order_date=o.order_date,
            pickup_code=o.pickup_code,
            items_summary=", ".join(f"{oi.quantity}x {oi.menu_item.item_name}" for oi in o.order_items) or "No items",
        )
        for o in database.scalars(recent_orders_stmt).all()
    ]

    return ManagerDashboardStats(
        shift_revenue=shift_revenue,
        orders_per_hour=orders_per_hour,
        pending_purchases_count=pending_purchases_count,
        active_team_count=len(shift_team),
        shift_team=shift_team,
        low_stock_items=low_stock_items,
        recent_orders=recent_orders,
    )


def get_cashier_dashboard_stats(database: Session) -> CashierDashboardStats:
    today_start = get_today_start()

    orders_count_stmt = select(func.count(Order.order_id)).where(Order.order_date >= today_start)
    my_orders_taken_count = database.scalar(orders_count_stmt) or 0

    sales_stmt = select(func.coalesce(func.sum(Order.total_amount), Decimal("0.00"))).where(
        Order.order_date >= today_start,
        Order.order_status.in_([
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.COMPLETED,
        ]),
    )
    register_sales_total = database.scalar(sales_stmt) or Decimal("0.00")

    awaiting_stmt = select(func.count(Order.order_id)).where(
        Order.order_status == OrderStatus.AWAITING_PAYMENT
    )
    awaiting_payment_count = database.scalar(awaiting_stmt) or 0

    ready_stmt = select(func.count(Order.order_id)).where(
        Order.order_status == OrderStatus.READY
    )
    ready_for_pickup_count = database.scalar(ready_stmt) or 0

    active_orders_stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
        )
        .where(
            Order.order_status.in_([
                OrderStatus.AWAITING_PAYMENT,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
            ])
        )
        .order_by(Order.order_date.desc())
        .limit(10)
    )

    active_orders = [
        RecentOrderInfo(
            order_id=o.order_id,
            customer_name=f"{o.customer.first_name} {o.customer.last_name or ''}".strip() if o.customer else "Guest",
            order_channel=o.order_channel,
            order_status=o.order_status,
            total_amount=o.total_amount,
            order_date=o.order_date,
            pickup_code=o.pickup_code,
            items_summary=", ".join(f"{oi.quantity}x {oi.menu_item.item_name}" for oi in o.order_items) or "No items",
        )
        for o in database.scalars(active_orders_stmt).all()
    ]

    return CashierDashboardStats(
        my_orders_taken_count=my_orders_taken_count,
        register_sales_total=register_sales_total,
        awaiting_payment_count=awaiting_payment_count,
        ready_for_pickup_count=ready_for_pickup_count,
        active_orders=active_orders,
    )


def get_barista_queue(database: Session) -> BaristaDashboardStats:
    today_start = get_today_start()
    now = utc_now()

    queued_stmt = select(func.count(Order.order_id)).where(
        Order.order_status == OrderStatus.CONFIRMED
    )
    queued_count = database.scalar(queued_stmt) or 0

    preparing_stmt = select(func.count(Order.order_id)).where(
        Order.order_status == OrderStatus.PREPARING
    )
    preparing_count = database.scalar(preparing_stmt) or 0

    completed_stmt = select(func.count(Order.order_id)).where(
        Order.order_date >= today_start,
        Order.order_status == OrderStatus.COMPLETED,
    )
    completed_today_count = database.scalar(completed_stmt) or 0

    # Live queue orders
    queue_stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(
            Order.order_status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY])
        )
        .order_by(Order.order_date.asc())
    )
    queue_orders = list(database.scalars(queue_stmt).all())

    tickets = []
    for o in queue_orders:
        elapsed = max(int((now - o.order_date).total_seconds() / 60), 0)
        items = []
        for oi in o.order_items:
            addons_list = [a.menu_item_addon.addon_name for a in oi.addons if a.menu_item_addon]
            items.append(
                BaristaTicketItem(
                    item_name=oi.menu_item.item_name,
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
            BaristaTicket(
                order_id=o.order_id,
                customer_name=customer_name,
                order_type=o.order_type,
                order_status=o.order_status,
                pickup_code=o.pickup_code,
                order_date=o.order_date,
                elapsed_minutes=elapsed,
                items=items,
            )
        )

    # Low stock ingredients
    low_stock_stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
    )
    low_stock_ingredients = [
        LowStockItemInfo(
            inventory_item_id=item.inventory_item_id,
            item_name=item.item_name,
            unit_of_measure=item.unit_of_measure,
            quantity_on_hand=item.quantity_on_hand,
            reorder_level=item.reorder_level,
            unit_cost=item.unit_cost,
            is_critical=item.quantity_on_hand <= (item.reorder_level * Decimal("0.5")),
        )
        for item in database.scalars(low_stock_stmt).all()
    ]

    return BaristaDashboardStats(
        queued_count=queued_count,
        preparing_count=preparing_count,
        completed_today_count=completed_today_count,
        tickets=tickets,
        low_stock_ingredients=low_stock_ingredients,
    )


def get_inventory_dashboard_stats(database: Session) -> InventoryStaffDashboardStats:
    total_items_stmt = select(func.count(InventoryItem.inventory_item_id)).where(InventoryItem.is_active.is_(True))
    total_tracked_items = database.scalar(total_items_stmt) or 0

    low_stock_stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
    )
    low_stock_rows = list(database.scalars(low_stock_stmt).all())
    low_stock_warnings_count = len(low_stock_rows)

    low_stock_items = [
        LowStockItemInfo(
            inventory_item_id=item.inventory_item_id,
            item_name=item.item_name,
            unit_of_measure=item.unit_of_measure,
            quantity_on_hand=item.quantity_on_hand,
            reorder_level=item.reorder_level,
            unit_cost=item.unit_cost,
            is_critical=item.quantity_on_hand <= (item.reorder_level * Decimal("0.5")),
        )
        for item in low_stock_rows
    ]

    active_pr_stmt = select(func.count(PurchaseRequest.purchase_request_id)).where(
        PurchaseRequest.request_status.in_([
            PurchaseRequestStatus.DRAFT,
            PurchaseRequestStatus.SUBMITTED,
            PurchaseRequestStatus.APPROVED,
        ])
    )
    active_purchase_requests_count = database.scalar(active_pr_stmt) or 0

    # Recent transactions
    tx_stmt = (
        select(InventoryTransaction)
        .options(
            selectinload(InventoryTransaction.inventory_item),
            selectinload(InventoryTransaction.creator),
        )
        .order_by(InventoryTransaction.transaction_date.desc())
        .limit(10)
    )
    recent_transactions = [
        InventoryTransactionInfo(
            transaction_id=tx.inventory_transaction_id,
            item_name=tx.inventory_item.item_name if tx.inventory_item else "Unknown Item",
            transaction_type=tx.transaction_type.value,
            quantity_change=tx.quantity_change,
            unit_of_measure=tx.inventory_item.unit_of_measure if tx.inventory_item else "units",
            created_by_name=f"{tx.creator.first_name} {tx.creator.last_name}" if tx.creator else "System",
            transaction_date=tx.transaction_date,
        )
        for tx in database.scalars(tx_stmt).all()
    ]

    return InventoryStaffDashboardStats(
        total_tracked_items=total_tracked_items,
        low_stock_warnings_count=low_stock_warnings_count,
        active_purchase_requests_count=active_purchase_requests_count,
        low_stock_items=low_stock_items,
        recent_transactions=recent_transactions,
    )


def get_combined_dashboard_overview(database: Session, user: User) -> CombinedDashboardResponse:
    user_roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]

    primary_role = "cashier"
    if "owner" in user_roles:
        primary_role = "owner"
    elif "manager" in user_roles:
        primary_role = "manager"
    elif "barista" in user_roles:
        primary_role = "barista"
    elif "inventory staff" in user_roles or "inventory_staff" in user_roles:
        primary_role = "inventory"

    owner_stats = get_owner_dashboard_stats(database)
    manager_stats = get_manager_dashboard_stats(database)
    cashier_stats = get_cashier_dashboard_stats(database)
    barista_stats = get_barista_queue(database)
    inventory_stats = get_inventory_dashboard_stats(database)

    return CombinedDashboardResponse(
        role=primary_role,
        owner_stats=owner_stats,
        manager_stats=manager_stats,
        cashier_stats=cashier_stats,
        barista_stats=barista_stats,
        inventory_stats=inventory_stats,
    )


def generate_store_reports(database: Session, period: str = "today") -> StoreReportResponse:
    """
    Generates consolidated reporting analytics for Manager and Owner roles.
    """
    now = utc_now()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_week":
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "all_time":
        start_date = None
    else:
        period = "today"
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)

    valid_statuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.COMPLETED,
    ]

    order_filter = [Order.order_status.in_(valid_statuses)]
    if start_date:
        order_filter.append(Order.order_date >= start_date)

    # 1. Total revenue
    rev_stmt = select(func.coalesce(func.sum(Order.total_amount), Decimal("0.00"))).where(*order_filter)
    total_revenue = database.scalar(rev_stmt) or Decimal("0.00")

    # 2. Total orders & completed orders
    count_filter = []
    if start_date:
        count_filter.append(Order.order_date >= start_date)
    total_orders_stmt = select(func.count(Order.order_id)).where(*count_filter)
    total_orders_count = database.scalar(total_orders_stmt) or 0

    completed_orders_stmt = select(func.count(Order.order_id)).where(
        Order.order_status == OrderStatus.COMPLETED,
        *count_filter,
    )
    completed_orders_count = database.scalar(completed_orders_stmt) or 0

    aov = (
        round(total_revenue / Decimal(completed_orders_count), 2)
        if completed_orders_count > 0
        else Decimal("0.00")
    )

    # 3. Top selling items
    top_items_stmt = (
        select(
            OrderItem.menu_item_id,
            MenuItem.item_name,
            func.sum(OrderItem.quantity).label("qty_sold"),
            func.sum(OrderItem.subtotal).label("total_item_sales"),
        )
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.menu_item_id)
        .join(Order, OrderItem.order_id == Order.order_id)
        .where(*order_filter)
        .group_by(OrderItem.menu_item_id, MenuItem.item_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    )
    top_items_rows = database.execute(top_items_stmt).all()
    top_selling_items = [
        TopSellingItem(
            menu_item_id=row.menu_item_id,
            item_name=row.item_name,
            quantity_sold=int(row.qty_sold or 0),
            total_sales=Decimal(str(row.total_item_sales or "0.00")),
        )
        for row in top_items_rows
    ]

    # 4. Sales by Channel
    channel_stmt = (
        select(
            Order.order_channel,
            func.count(Order.order_id).label("channel_count"),
            func.coalesce(func.sum(Order.total_amount), Decimal("0.00")).label("channel_revenue"),
        )
        .where(*order_filter)
        .group_by(Order.order_channel)
    )
    channel_rows = database.execute(channel_stmt).all()
    sales_by_channel = [
        ChannelSales(
            channel="In-Store POS" if str(row.order_channel.value if hasattr(row.order_channel, "value") else row.order_channel) == "pos" else "Online Web Order",
            order_count=int(row.channel_count or 0),
            total_sales=Decimal(str(row.channel_revenue or "0.00")),
        )
        for row in channel_rows
    ]

    # 5. Sales by Payment Method
    pm_filter = [Payment.payment_status == PaymentStatus.COMPLETED]
    if start_date:
        pm_filter.append(Payment.created_at >= start_date)
    pm_stmt = (
        select(
            Payment.payment_method,
            func.count(Payment.payment_id).label("pm_count"),
            func.coalesce(func.sum(Payment.amount_paid), Decimal("0.00")).label("pm_total"),
        )
        .where(*pm_filter)
        .group_by(Payment.payment_method)
    )
    pm_rows = database.execute(pm_stmt).all()
    sales_by_payment_method = [
        PaymentMethodSales(
            payment_method=str(row.payment_method.value if hasattr(row.payment_method, "value") else row.payment_method).replace("_", " ").title(),
            transaction_count=int(row.pm_count or 0),
            total_amount=Decimal(str(row.pm_total or "0.00")),
        )
        for row in pm_rows
    ]

    # 6. Timeline
    timeline = []
    if period == "today":
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        for hour in range(6, 24, 3):
            t_start = day_start + timedelta(hours=hour)
            t_end = t_start + timedelta(hours=3)
            slot_stmt = select(
                func.coalesce(func.sum(Order.total_amount), Decimal("0.00")),
                func.count(Order.order_id),
            ).where(
                Order.order_status.in_(valid_statuses),
                Order.order_date >= t_start,
                Order.order_date < t_end,
            )
            slot_rev, slot_cnt = database.execute(slot_stmt).one()
            timeline.append(
                TimelinePoint(
                    label=f"{hour:02d}:00",
                    sales=slot_rev or Decimal("0.00"),
                    orders_count=slot_cnt or 0,
                )
            )
    else:
        for i in range(6, -1, -1):
            day_cursor = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            next_day = day_cursor + timedelta(days=1)
            slot_stmt = select(
                func.coalesce(func.sum(Order.total_amount), Decimal("0.00")),
                func.count(Order.order_id),
            ).where(
                Order.order_status.in_(valid_statuses),
                Order.order_date >= day_cursor,
                Order.order_date < next_day,
            )
            slot_rev, slot_cnt = database.execute(slot_stmt).one()
            timeline.append(
                TimelinePoint(
                    label=day_cursor.strftime("%a %d"),
                    sales=slot_rev or Decimal("0.00"),
                    orders_count=slot_cnt or 0,
                )
            )

    return StoreReportResponse(
        period=period,
        total_revenue=total_revenue,
        total_orders_count=total_orders_count,
        completed_orders_count=completed_orders_count,
        average_order_value=aov,
        top_selling_items=top_selling_items,
        sales_by_channel=sales_by_channel,
        sales_by_payment_method=sales_by_payment_method,
        timeline=timeline,
    )
