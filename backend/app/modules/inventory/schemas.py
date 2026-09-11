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


class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=100)
    unit_of_measure: str = Field(..., min_length=1, max_length=20)
    quantity_on_hand: Decimal = Field(default=Decimal("0.0"), ge=0)
    reorder_level: Decimal = Field(default=Decimal("10.0"), ge=0)
    unit_cost: Decimal = Field(default=Decimal("0.0"), ge=0)
    is_active: bool = True


class InventoryItemUpdate(BaseModel):
    item_name: str | None = Field(default=None, min_length=1, max_length=100)
    unit_of_measure: str | None = Field(default=None, min_length=1, max_length=20)
    reorder_level: Decimal | None = Field(default=None, ge=0)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class InventoryTransactionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_transaction_id: int
    inventory_item_id: int
    item_name: str
    unit_of_measure: str
    transaction_type: InventoryTransactionType
    quantity_change: Decimal
    reference_type: str | None = None
    reference_id: int | None = None
    notes: str | None = None
    created_by: int
    creator_name: str | None = None
    transaction_date: datetime
    created_at: datetime


class InventoryForecastItem(BaseModel):
    inventory_item_id: int
    item_name: str
    unit_of_measure: str
    quantity_on_hand: Decimal
    average_daily_usage: Decimal
    projected_days_remaining: Decimal | None
    suggested_purchase_quantity: Decimal


class InventoryForecastResponse(BaseModel):
    forecast_days: int
    items: list[InventoryForecastItem]


class ForecastPurchaseRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=30)
