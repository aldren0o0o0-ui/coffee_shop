from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class FulfilmentTicketItem(BaseModel):
    menu_item_id: int
    item_name: str
    size_name: str | None = None
    quantity: int
    special_instructions: str | None = None
    addons: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FulfilmentQueueTicket(BaseModel):
    order_id: int
    customer_name: str
    order_channel: str
    order_type: str
    order_status: str
    pickup_code: str | None = None
    order_date: datetime
    elapsed_minutes: int
    estimated_prep_minutes: int
    priority_rank: int
    items: list[FulfilmentTicketItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FulfilmentQueueResponse(BaseModel):
    tickets: list[FulfilmentQueueTicket]
    active_count: int
    average_wait_minutes: float
    estimated_queue_drain_minutes: int


class PickupBoardTicket(BaseModel):
    pickup_code: str
    order_status: str  # "preparing" or "ready"
    display_status: str  # "Brewing & Preparing" or "Ready for Collection"
    ready_since_minutes: int | None = None

    model_config = ConfigDict(from_attributes=True)


class PickupBoardResponse(BaseModel):
    preparing: list[PickupBoardTicket]
    ready: list[PickupBoardTicket]
    last_updated: datetime


class ReorderValidationRequest(BaseModel):
    email: str


class ReorderItemSummary(BaseModel):
    menu_item_id: int
    item_name: str
    size_name: str | None = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    is_available: bool = True
    stock_status: str = "in_stock"


class ReorderResponse(BaseModel):
    original_order_id: int
    items: list[ReorderItemSummary]
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    can_reorder: bool
    unavailable_reasons: list[str] = Field(default_factory=list)
