from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.payments.models import Payment, PaymentMethod, PaymentStatus
from app.modules.shifts.models import (
    CashMovement,
    CashMovementType,
    Shift,
    ShiftStatus,
    VarianceReviewStatus,
)


def add_cash_movement(database: Session, shift: Shift, movement_type: CashMovementType, amount: Decimal, reason: str, user_id: int) -> CashMovement:
    if shift.status != ShiftStatus.OPEN: raise HTTPException(status_code=400, detail="Cash movements require an open shift.")
    movement = CashMovement(shift_id=shift.shift_id, movement_type=movement_type, amount=amount, reason=reason.strip(), created_by=user_id, created_at=datetime.now(timezone.utc))
    database.add(movement); database.commit(); database.refresh(movement); return movement

def get_open_shift(database: Session) -> Shift | None:
    return database.scalar(select(Shift).where(Shift.status == ShiftStatus.OPEN).order_by(Shift.opened_at.desc()).limit(1))

def open_shift(database: Session, user_id: int, opening_cash: Decimal, notes: str | None) -> Shift:
    if get_open_shift(database): raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A register shift is already open.")
    shift = Shift(opened_by=user_id, status=ShiftStatus.OPEN, opening_cash=opening_cash, opened_at=datetime.now(timezone.utc), notes=notes)
    database.add(shift); database.commit(); database.refresh(shift); return shift

def close_shift(database: Session, shift: Shift, user_id: int, counted_cash: Decimal, notes: str | None) -> Shift:
    if shift.status != ShiftStatus.OPEN: raise HTTPException(status_code=400, detail="Shift is already closed.")
    cash_sales = database.scalar(select(func.coalesce(func.sum(Payment.amount_paid - func.coalesce(Payment.change_due, 0)), 0)).where(Payment.payment_status == PaymentStatus.COMPLETED, Payment.payment_method == PaymentMethod.CASH, Payment.paid_at >= shift.opened_at)) or Decimal("0.00")
    movements = database.scalar(select(func.coalesce(func.sum(CashMovement.amount), 0)).where(CashMovement.shift_id == shift.shift_id, CashMovement.movement_type.in_([CashMovementType.PAID_IN, CashMovementType.ADJUSTMENT]))) or 0
    outflows = database.scalar(select(func.coalesce(func.sum(CashMovement.amount), 0)).where(CashMovement.shift_id == shift.shift_id, CashMovement.movement_type.in_([CashMovementType.PAID_OUT, CashMovementType.REFUND]))) or 0
    shift.expected_cash = shift.opening_cash + Decimal(cash_sales) + Decimal(movements) - Decimal(outflows); shift.counted_cash = counted_cash; shift.variance = counted_cash - shift.expected_cash
    shift.variance_review_status = VarianceReviewStatus.PENDING if abs(shift.variance) >= Decimal("100.00") else VarianceReviewStatus.NOT_REQUIRED
    shift.closed_by = user_id; shift.closed_at = datetime.now(timezone.utc); shift.status = ShiftStatus.CLOSED; shift.notes = notes or shift.notes
    database.commit(); database.refresh(shift); return shift

def approve_variance(database: Session, shift: Shift, approver_id: int) -> Shift:
    if shift.variance_review_status != VarianceReviewStatus.PENDING:
        raise HTTPException(status_code=400, detail="This shift does not require variance approval.")
    shift.variance_review_status = VarianceReviewStatus.APPROVED
    shift.variance_approved_by = approver_id
    shift.variance_approved_at = datetime.now(timezone.utc)
    database.commit(); database.refresh(shift); return shift

def list_pending_variances(database: Session) -> list[Shift]:
    return list(database.scalars(select(Shift).where(Shift.variance_review_status == VarianceReviewStatus.PENDING).order_by(Shift.closed_at.desc())).all())
