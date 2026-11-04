from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.shared.mixins import TimestampMixin


class ShiftStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class CashMovementType(str, Enum):
    PAID_IN = "paid_in"
    PAID_OUT = "paid_out"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class VarianceReviewStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"


class Shift(TimestampMixin, Base):
    __tablename__ = "shifts"
    __table_args__ = (CheckConstraint("opening_cash >= 0", name="ck_shift_opening_cash_nonnegative"),)

    shift_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.branch_id"), default=1, server_default="1", nullable=False, index=True)
    opened_by: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    closed_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    status: Mapped[ShiftStatus] = mapped_column(SqlEnum(ShiftStatus, native_enum=False), default=ShiftStatus.OPEN, nullable=False, index=True)
    opening_cash: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    expected_cash: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    counted_cash: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    variance: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    variance_review_status: Mapped[VarianceReviewStatus] = mapped_column(SqlEnum(VarianceReviewStatus, native_enum=False), default=VarianceReviewStatus.NOT_REQUIRED, nullable=False)
    variance_approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    variance_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CashMovement(Base):
    __tablename__ = "cash_movements"
    cash_movement_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.shift_id", ondelete="RESTRICT"), nullable=False, index=True)
    movement_type: Mapped[CashMovementType] = mapped_column(SqlEnum(CashMovementType, native_enum=False), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
