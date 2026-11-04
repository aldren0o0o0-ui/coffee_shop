from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.shifts.models import (
    CashMovementType,
    ShiftStatus,
    VarianceReviewStatus,
)


class OpenShiftRequest(BaseModel):
    opening_cash: Decimal = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)

class CloseShiftRequest(BaseModel):
    counted_cash: Decimal = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)

class ShiftResponse(BaseModel):
    shift_id: int; opened_by: int; closed_by: int | None; status: ShiftStatus
    opening_cash: Decimal; expected_cash: Decimal | None; counted_cash: Decimal | None; variance: Decimal | None
    opened_at: datetime; closed_at: datetime | None; notes: str | None
    variance_review_status: VarianceReviewStatus
    variance_approved_by: int | None
    variance_approved_at: datetime | None

class CashMovementRequest(BaseModel):
    movement_type: CashMovementType
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=1, max_length=500)
