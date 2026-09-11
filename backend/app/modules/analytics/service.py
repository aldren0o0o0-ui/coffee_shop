from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

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
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
)
from app.modules.menu.models import (
    MenuItem,
    MenuItemIngredient,
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
from app.modules.notifications.models import SystemAlert
from app.modules.notifications.service import evaluate_system_alerts
from app.modules.shifts.models import Shift, ShiftStatus
from app.modules.users.models import User, UserRole


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_store_timezone():
    try:
        import zoneinfo
        return zoneinfo.ZoneInfo("Asia/Manila")
    except Exception:
        local_tz = datetime.now().astimezone().tzinfo
        return local_tz or timezone.utc


def get_today_start() -> datetime:
    store_tz = get_store_timezone()
    return datetime.now(store_tz).replace(hour=0, minute=0, second=0, microsecond=0)


def get_owner_dashboard_stats(database: Session, branch_id: int | None = None) -> OwnerDashboardStats:
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
    if branch_id is not None:
        revenue_stmt = revenue_stmt.where(Order.branch_id == branch_id)
    today_revenue = database.scalar(revenue_stmt) or Decimal("0.00")

    # Order counts
    total_orders_stmt = select(func.count(Order.order_id)).where(Order.order_date >= today_start)
    if branch_id is not None:
        total_orders_stmt = total_orders_stmt.where(Order.branch_id == branch_id)
    today_orders_count = database.scalar(total_orders_stmt) or 0

    completed_orders_stmt = select(func.count(Order.order_id)).where(
        Order.order_date >= today_start,
        Order.order_status == OrderStatus.COMPLETED,
    )
    if branch_id is not None:
        completed_orders_stmt = completed_orders_stmt.where(Order.branch_id == branch_id)
    completed_orders_count = database.scalar(completed_orders_stmt) or 0

    # Active staff
    active_staff_stmt = select(func.count(User.user_id)).where(User.is_active.is_(True))
    if branch_id is not None:
        active_staff_stmt = active_staff_stmt.where(User.branch_id == branch_id)
    active_staff_count = database.scalar(active_staff_stmt) or 0

    # Low stock items
    low_stock_stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
    )
    if branch_id is not None:
        low_stock_stmt = low_stock_stmt.where(InventoryItem.branch_id == branch_id)
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
    )
    if branch_id is not None:
        recent_orders_stmt = recent_orders_stmt.where(Order.branch_id == branch_id)
    recent_order_rows = list(database.scalars(recent_orders_stmt.limit(5)).all())

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

    # Cash variance today from closed shifts
    variance_stmt = select(func.coalesce(func.sum(Shift.variance), Decimal("0.00"))).where(
        Shift.status == ShiftStatus.CLOSED,
        Shift.closed_at >= today_start,
    )
    if branch_id is not None:
        variance_stmt = variance_stmt.where(Shift.branch_id == branch_id)
    cash_variance_today = database.scalar(variance_stmt) or Decimal("0.00")

    # Queue health
    queue_stmt = select(Order).where(
        Order.order_status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING]),
    )
    if branch_id is not None:
        queue_stmt = queue_stmt.where(Order.branch_id == branch_id)
    active_queue = list(database.scalars(queue_stmt).all())
    total_queued = len(active_queue)
    now_utc = datetime.now(timezone.utc)
    delayed_count = 0
    total_wait_mins = 0
    for o in active_queue:
        od = o.order_date
        if od.tzinfo is None:
            od = od.replace(tzinfo=timezone.utc)
        mins = max(0, int((now_utc - od).total_seconds() / 60))
        if mins > 20:
            delayed_count += 1
        total_wait_mins += mins
    avg_wait = round(total_wait_mins / total_queued, 1) if total_queued > 0 else 0.0
    queue_status = "delayed" if delayed_count > 0 else ("busy" if total_queued >= 5 else "healthy")
    queue_health = {
        "total_queued": total_queued,
        "delayed_count": delayed_count,
        "avg_wait_minutes": avg_wait,
        "status": queue_status,
    }

    # Active alerts count
    try:
        evaluate_system_alerts(database)
    except Exception:
        pass

    alert_stmt = select(func.count(SystemAlert.alert_id)).where(SystemAlert.is_resolved.is_(False))
    if branch_id is not None:
        alert_stmt = alert_stmt.where((SystemAlert.branch_id == branch_id) | (SystemAlert.branch_id.is_(None)))
    active_alerts_count = database.scalar(alert_stmt) or 0

    return OwnerDashboardStats(
        today_revenue=today_revenue,
        today_orders_count=today_orders_count,
        completed_orders_count=completed_orders_count,
        active_staff_count=active_staff_count,
        low_stock_count=low_stock_count,
        recent_orders=recent_orders,
        low_stock_items=low_stock_items,
        cash_variance_today=cash_variance_today,
        queue_health=queue_health,
        active_alerts_count=active_alerts_count,
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
        order_date = o.order_date
        if order_date.tzinfo is None:
            order_date = order_date.replace(tzinfo=timezone.utc)
        elapsed = max(int((now - order_date).total_seconds() / 60), 0)
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


def get_combined_dashboard_overview(database: Session, user: User, branch_id: int | None = None) -> CombinedDashboardResponse:
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

    effective_branch_id = branch_id if branch_id is not None else getattr(user, "branch_id", None)
    owner_stats = get_owner_dashboard_stats(database, branch_id=effective_branch_id)
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
    store_tz = get_store_timezone()
    now_local = datetime.now(store_tz)
    if period == "today":
        start_date = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_week":
        start_date = (now_local - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_month":
        start_date = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "all_time":
        start_date = None
    else:
        period = "today"
        start_date = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

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

    # 3. Estimated Cost of Goods Sold (COGS) & Gross Profit
    cogs_stmt = (
        select(
            func.coalesce(
                func.sum(
                    OrderItem.quantity
                    * MenuItemIngredient.quantity_required
                    * InventoryItem.unit_cost
                ),
                Decimal("0.00"),
            )
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(
            MenuItemIngredient,
            OrderItem.menu_item_id == MenuItemIngredient.menu_item_id,
        )
        .join(
            InventoryItem,
            MenuItemIngredient.inventory_item_id == InventoryItem.inventory_item_id,
        )
        .where(*order_filter)
    )
    estimated_cogs = database.scalar(cogs_stmt) or Decimal("0.00")
    estimated_cogs = round(estimated_cogs, 2)
    gross_profit = max(total_revenue - estimated_cogs, Decimal("0.00"))
    profit_margin = (
        round(float((gross_profit / total_revenue) * 100), 1)
        if total_revenue > 0
        else 0.0
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

    # 6. Timeline Generation
    slots: list[tuple[str, datetime, datetime]] = []
    if period == "today":
        day_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        for hour in range(0, 24, 2):
            slot_start = day_start + timedelta(hours=hour)
            slot_end = slot_start + timedelta(hours=2)
            slots.append((f"{hour:02d}:00", slot_start, slot_end))
    elif period == "this_week":
        for i in range(6, -1, -1):
            slot_start = (now_local - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            slot_end = slot_start + timedelta(days=1)
            slots.append((slot_start.strftime("%a %d"), slot_start, slot_end))
    elif period == "this_month":
        for day in range(1, now_local.day + 1):
            slot_start = now_local.replace(day=day, hour=0, minute=0, second=0, microsecond=0)
            slot_end = slot_start + timedelta(days=1)
            slots.append((slot_start.strftime("%b %d"), slot_start, slot_end))
    elif period == "all_time":
        current_year = now_local.year
        current_month = now_local.month
        for m_offset in range(5, -1, -1):
            m = current_month - m_offset
            y = current_year
            while m <= 0:
                m += 12
                y -= 1
            slot_start = datetime(y, m, 1, 0, 0, 0, tzinfo=store_tz)
            if m == 12:
                slot_end = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=store_tz)
            else:
                slot_end = datetime(y, m + 1, 1, 0, 0, 0, tzinfo=store_tz)
            slots.append((slot_start.strftime("%b '%y"), slot_start, slot_end))
    else:
        for i in range(6, -1, -1):
            slot_start = (now_local - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            slot_end = slot_start + timedelta(days=1)
            slots.append((slot_start.strftime("%a %d"), slot_start, slot_end))

    # Single-query timeline aggregation for speed and accuracy
    timeline_filter = [Order.order_status.in_(valid_statuses)]
    if slots:
        timeline_filter.append(Order.order_date >= slots[0][1])
        timeline_filter.append(Order.order_date < slots[-1][2])

    timeline_stmt = select(Order.order_date, Order.total_amount).where(*timeline_filter)
    timeline_orders = database.execute(timeline_stmt).all()

    timeline: list[TimelinePoint] = []
    for label, slot_start, slot_end in slots:
        slot_sales = Decimal("0.00")
        slot_cnt = 0
        for o_date, o_amt in timeline_orders:
            if o_date is not None:
                o_dt = o_date if o_date.tzinfo is not None else o_date.replace(tzinfo=store_tz)
                if slot_start <= o_dt < slot_end:
                    slot_sales += o_amt or Decimal("0.00")
                    slot_cnt += 1
        timeline.append(
            TimelinePoint(
                label=label,
                sales=slot_sales,
                orders_count=slot_cnt,
            )
        )

    return StoreReportResponse(
        period=period,
        total_revenue=total_revenue,
        total_orders_count=total_orders_count,
        completed_orders_count=completed_orders_count,
        average_order_value=aov,
        estimated_cogs=estimated_cogs,
        gross_profit=gross_profit,
        profit_margin_percentage=profit_margin,
        top_selling_items=top_selling_items,
        sales_by_channel=sales_by_channel,
        sales_by_payment_method=sales_by_payment_method,
        timeline=timeline,
    )
