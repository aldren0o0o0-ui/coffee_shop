from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

from app.modules.inventory.models import InventoryTransactionType


class InventoryOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_item_id: int
    item_name: str
    unit_of_measure: str
    quantity_on_hand: Decimal


class InventoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_item_id: int
    item_name: str
    unit_of_measure: str
    quantity_on_hand: Decimal
    reorder_level: Decimal
    unit_cost: Decimal
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class InventoryTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_transaction_id: int
    inventory_item_id: int
    transaction_type: InventoryTransactionType
    quantity_change: Decimal
    reference_type: str | None = None
    reference_id: int | None = None
    notes: str | None = None
    created_by: int
    transaction_date: datetime
    created_at: datetime


class InventoryAdjustmentRequest(BaseModel):
    quantity_change: Decimal = Field(..., description="Positive for addition/adjustment, negative for deduction/waste")
    transaction_type: InventoryTransactionType = Field(default=InventoryTransactionType.ADJUSTMENT)
    notes: str | None = Field(default=None, max_length=500)
