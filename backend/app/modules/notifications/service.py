from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.inventory.models import InventoryItem
from app.modules.notifications.models import AlertPreference, SystemAlert
from app.modules.notifications.schemas import AlertPreferenceUpdate
from app.modules.orders.models import Order, OrderStatus
from app.modules.procurement.models import PurchaseRequest, PurchaseRequestStatus
from app.modules.shifts.models import Shift, ShiftStatus
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def evaluate_system_alerts(database: Session) -> int:
    """
    Evaluates business operational conditions and raises SystemAlert records:
    1. Critical stock (<= 50% of reorder level)
    2. Cash variance on closed shifts
    3. Order queue delays (> 20 mins waiting)
    4. Pending procurement requests (> 24 hours submitted)
    Applies a 2-hour cooldown on duplicate unresolved alerts.
    """
    now = utc_now()
    cooldown_threshold = now - timedelta(hours=2)
    new_alerts_count = 0

    # Helper to create alert if not already recently active
    def emit_alert(alert_type: str, severity: str, title: str, message: str, branch_id: int | None = None):
        nonlocal new_alerts_count
        recent_alert = database.scalar(
            select(SystemAlert)
            .where(
                SystemAlert.alert_type == alert_type,
                SystemAlert.title == title,
                SystemAlert.is_resolved.is_(False),
                SystemAlert.created_at >= cooldown_threshold,
            )
            .limit(1)
        )
        if not recent_alert:
            alert = SystemAlert(
                branch_id=branch_id,
                alert_type=alert_type,
                severity=severity,
                title=title,
                message=message,
                created_at=now,
            )
            database.add(alert)
            new_alerts_count += 1

    # 1. Critical stock alerts
    critical_items = list(
        database.scalars(
            select(InventoryItem).where(
                InventoryItem.is_active.is_(True),
                InventoryItem.quantity_on_hand <= (InventoryItem.reorder_level * Decimal("0.5")),
            )
        ).all()
    )
    for it in critical_items:
        branch_id = getattr(it, "branch_id", 1)
        emit_alert(
            alert_type="stock_critical",
            severity="critical",
            title=f"Critical Low Stock: {it.item_name}",
            message=f"Only {it.quantity_on_hand} {it.unit_of_measure} left (reorder minimum is {it.reorder_level} {it.unit_of_measure}). Restock immediately.",
            branch_id=branch_id,
        )

    # 2. Cash variance alerts on closed register shifts
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    variance_shifts = list(
        database.scalars(
            select(Shift).where(
                Shift.status == ShiftStatus.CLOSED,
                Shift.closed_at >= today_start,
                Shift.variance.is_not(None),
                Shift.variance != Decimal("0.00"),
            )
        ).all()
    )
    for shift in variance_shifts:
        variance_val = shift.variance or Decimal("0.00")
        branch_id = getattr(shift, "branch_id", 1)
        emit_alert(
            alert_type="cash_variance",
            severity="warning" if abs(variance_val) < Decimal("500.00") else "critical",
            title=f"Shift #{shift.shift_id} Cash Discrepancy",
            message=f"Shift closed with variance of ₱{variance_val:.2f}. Requires manager review.",
            branch_id=branch_id,
        )

    # 3. Order queue delays (> 20 mins waiting in CONFIRMED or PREPARING)
    stalled_threshold = now - timedelta(minutes=20)
    stalled_orders = list(
        database.scalars(
            select(Order).where(
                Order.order_status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING]),
                Order.order_date <= stalled_threshold,
            )
        ).all()
    )
    for order in stalled_orders:
        branch_id = getattr(order, "branch_id", 1)
        emit_alert(
            alert_type="queue_delay",
            severity="warning",
            title=f"Preparation Delay: Order #{order.order_id}",
            message=f"Order has been in queue for over 20 minutes ({order.pickup_code or 'no code'}). Check barista station.",
            branch_id=branch_id,
        )

    # 4. Pending procurement requests (> 24 hours submitted)
    old_pr_threshold = now - timedelta(hours=24)
    pending_prs = list(
        database.scalars(
            select(PurchaseRequest).where(
                PurchaseRequest.request_status == PurchaseRequestStatus.SUBMITTED,
                PurchaseRequest.created_at <= old_pr_threshold,
            )
        ).all()
    )
    for pr in pending_prs:
        branch_id = getattr(pr, "branch_id", 1)
        emit_alert(
            alert_type="procurement_pending",
            severity="info",
            title=f"Pending Approval: Purchase Request #{pr.purchase_request_id}",
            message=f"Purchase request for ₱{pr.total_amount:.2f} has been awaiting approval for over 24 hours.",
            branch_id=branch_id,
        )

    if new_alerts_count > 0:
        database.commit()
        logger.info(f"System alert evaluation created {new_alerts_count} operational alerts.")

    return new_alerts_count


def list_alerts(
    database: Session,
    branch_id: int | None = None,
    is_resolved: bool | None = False,
    limit: int = 50,
) -> list[SystemAlert]:
    # Run lazy evaluation so alerts stay up-to-date
    evaluate_system_alerts(database)

    stmt = select(SystemAlert).order_by(SystemAlert.created_at.desc())
    if branch_id is not None:
        stmt = stmt.where((SystemAlert.branch_id == branch_id) | (SystemAlert.branch_id.is_(None)))
    if is_resolved is not None:
        stmt = stmt.where(SystemAlert.is_resolved.is_(is_resolved))

    return list(database.scalars(stmt.limit(limit)).all())


def resolve_alert(
    database: Session,
    alert_id: int,
    actor: User,
) -> SystemAlert:
    alert = database.get(SystemAlert, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert #{alert_id} not found.",
        )

    alert.is_resolved = True
    alert.resolved_by_user_id = actor.user_id
    alert.resolved_at = utc_now()
    database.commit()
    database.refresh(alert)
    return alert


def get_user_preferences(database: Session, user_id: int) -> AlertPreference:
    pref = database.scalar(select(AlertPreference).where(AlertPreference.user_id == user_id))
    if not pref:
        pref = AlertPreference(
            user_id=user_id,
            email_alerts=True,
            stock_alerts=True,
            financial_alerts=True,
            min_severity="warning",
        )
        database.add(pref)
        database.commit()
        database.refresh(pref)
    return pref


def update_user_preferences(
    database: Session,
    user_id: int,
    payload: AlertPreferenceUpdate,
) -> AlertPreference:
    pref = get_user_preferences(database, user_id)
    if payload.email_alerts is not None:
        pref.email_alerts = payload.email_alerts
    if payload.stock_alerts is not None:
        pref.stock_alerts = payload.stock_alerts
    if payload.financial_alerts is not None:
        pref.financial_alerts = payload.financial_alerts
    if payload.min_severity is not None:
        pref.min_severity = payload.min_severity

    database.commit()
    database.refresh(pref)
    return pref
