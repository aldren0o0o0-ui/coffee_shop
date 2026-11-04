from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.customers.models import Customer
from app.modules.engagement.schemas import WinBackAudienceResponse
from app.modules.orders.models import Order, OrderStatus


def get_win_back_audience(database: Session, inactive_days: int) -> WinBackAudienceResponse:
    cutoff = datetime.now(timezone.utc) - timedelta(days=inactive_days)
    last_order = select(Order.customer_id, func.max(Order.order_date).label("last_order")).where(Order.order_status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED])).group_by(Order.customer_id).subquery()
    count = database.scalar(select(func.count(Customer.customer_id)).outerjoin(last_order, Customer.customer_id == last_order.c.customer_id).where(Customer.marketing_consent.is_(True), Customer.is_blocked.is_(False), (last_order.c.last_order.is_(None)) | (last_order.c.last_order < cutoff))) or 0
    return WinBackAudienceResponse(inactive_days=inactive_days, eligible_customers=count)
