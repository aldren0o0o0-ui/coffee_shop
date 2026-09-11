from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.procurement.models import PurchaseRequestStatus


class PurchaseRequestItemCreate(BaseModel):
    inventory_item_id: int
    quantity_requested: Decimal = Field(..., gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0, description="Optional override; defaults to current InventoryItem.unit_cost")


class PurchaseRequestItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    purchase_request_item_id: int
    purchase_request_id: int
    inventory_item_id: int
    item_name: str | None = None
    unit_of_measure: str | None = None
    quantity_requested: Decimal
    unit_cost: Decimal
    subtotal: Decimal


class PurchaseRequestCreate(BaseModel):
    expected_delivery_date: date | None = None
    items: list[PurchaseRequestItemCreate] = Field(default_factory=list)


class PurchaseRequestUpdate(BaseModel):
    expected_delivery_date: date | None = None
    items: list[PurchaseRequestItemCreate] = Field(default_factory=list)


class PurchaseRequestRejectionRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=1, max_length=500)


class PurchaseRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    purchase_request_id: int
    requested_by: int
    requester_name: str | None = None
    request_status: PurchaseRequestStatus
    rejection_reason: str | None = None
    request_date: datetime
    expected_delivery_date: date | None = None
    total_amount: Decimal
    items: list[PurchaseRequestItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None
