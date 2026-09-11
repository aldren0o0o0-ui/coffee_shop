from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.orders.models import OrderChannel, OrderStatus, OrderType


class LowStockItemInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_item_id: int
    item_name: str
    unit_of_measure: str
    quantity_on_hand: Decimal
    reorder_level: Decimal
    unit_cost: Decimal
    is_critical: bool


class BaristaTicketItem(BaseModel):
    item_name: str
    size_name: str | None = None
    quantity: int
    special_instructions: str | None = None
    addons: list[str] = Field(default_factory=list)


class BaristaTicket(BaseModel):
    order_id: int
    customer_name: str
    order_type: OrderType
    order_status: OrderStatus
    pickup_code: str | None = None
    order_date: datetime
    elapsed_minutes: int
    items: list[BaristaTicketItem]


class RecentOrderInfo(BaseModel):
    order_id: int
    customer_name: str
    order_channel: OrderChannel
    order_status: OrderStatus
    total_amount: Decimal
    order_date: datetime
    pickup_code: str | None = None
    items_summary: str


class ShiftTeamMember(BaseModel):
    user_id: int
    full_name: str
    username: str
    role_name: str
    last_login_at: datetime | None


class InventoryTransactionInfo(BaseModel):
    transaction_id: int
    item_name: str
    transaction_type: str
    quantity_change: Decimal
    unit_of_measure: str
    created_by_name: str
    transaction_date: datetime


class OwnerDashboardStats(BaseModel):
    today_revenue: Decimal
    today_orders_count: int
    completed_orders_count: int
    active_staff_count: int
    low_stock_count: int
    recent_orders: list[RecentOrderInfo]
    low_stock_items: list[LowStockItemInfo]
    cash_variance_today: Decimal | None = None
    queue_health: dict | None = None
    active_alerts_count: int = 0


class ManagerDashboardStats(BaseModel):
    shift_revenue: Decimal
    orders_per_hour: float
    pending_purchases_count: int
    active_team_count: int
    shift_team: list[ShiftTeamMember]
    low_stock_items: list[LowStockItemInfo]
    recent_orders: list[RecentOrderInfo]


class CashierDashboardStats(BaseModel):
    my_orders_taken_count: int
    register_sales_total: Decimal
    awaiting_payment_count: int
    ready_for_pickup_count: int
    active_orders: list[RecentOrderInfo]


class BaristaDashboardStats(BaseModel):
    queued_count: int
    preparing_count: int
    completed_today_count: int
    tickets: list[BaristaTicket]
    low_stock_ingredients: list[LowStockItemInfo]


class InventoryStaffDashboardStats(BaseModel):
    total_tracked_items: int
    low_stock_warnings_count: int
    active_purchase_requests_count: int
    low_stock_items: list[LowStockItemInfo]
    recent_transactions: list[InventoryTransactionInfo]


class CombinedDashboardResponse(BaseModel):
    role: str
    owner_stats: OwnerDashboardStats | None = None
    manager_stats: ManagerDashboardStats | None = None
    cashier_stats: CashierDashboardStats | None = None
    barista_stats: BaristaDashboardStats | None = None
    inventory_stats: InventoryStaffDashboardStats | None = None


class TopSellingItem(BaseModel):
    menu_item_id: int
    item_name: str
    quantity_sold: int
    total_sales: Decimal


class ChannelSales(BaseModel):
    channel: str
    order_count: int
    total_sales: Decimal


class PaymentMethodSales(BaseModel):
    payment_method: str
    transaction_count: int
    total_amount: Decimal


class TimelinePoint(BaseModel):
    label: str
    sales: Decimal
    orders_count: int


class StoreReportResponse(BaseModel):
    period: str
    total_revenue: Decimal
    total_orders_count: int
    completed_orders_count: int
    average_order_value: Decimal
    estimated_cogs: Decimal = Decimal("0.00")
    gross_profit: Decimal = Decimal("0.00")
    profit_margin_percentage: float = 0.0
    top_selling_items: list[TopSellingItem]
    sales_by_channel: list[ChannelSales]
    sales_by_payment_method: list[PaymentMethodSales]
    timeline: list[TimelinePoint]
