from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.orders.models import OrderChannel, OrderStatus, OrderType
from app.modules.payments.models import PaymentMethod


class OrderItemAddonCreate(BaseModel):
    menu_item_addon_id: int
    quantity: int = Field(default=1, ge=1, le=10)


class OrderItemCreate(BaseModel):
    menu_item_id: int
    menu_item_size_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=20)
    special_instructions: str | None = Field(default=None, max_length=255)
    addons: list[OrderItemAddonCreate] = Field(default_factory=list)


class CustomerOrderCreateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    email: EmailStr
    phone_number: str | None = Field(default=None, max_length=20)
    order_type: OrderType = OrderType.TAKEOUT
    payment_method_intent: str = Field(
        default="online_card",
        description="online_card | online_ewallet | pay_at_counter",
    )
    items: list[OrderItemCreate] = Field(min_length=1)


class POSOrderCreateRequest(BaseModel):
    customer_name: str = Field(default="Walk-in Guest", max_length=100)
    customer_email: EmailStr | None = None
    order_type: OrderType = OrderType.DINE_IN
    payment_method: PaymentMethod = PaymentMethod.CASH
    amount_tendered: Decimal | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class PendingOrderUpdateRequest(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)
    order_type: OrderType | None = None


class OrderTrackingRequest(BaseModel):
    order_id: int
    email: EmailStr


class OrderItemAddonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_item_addon_id: int
    addon_name: str
    quantity: int
    unit_price: Decimal


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_item_id: int
    item_name: str
    size_name: str | None = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    special_instructions: str | None = None
    addons: list[OrderItemAddonResponse] = Field(default_factory=list)


class CustomerOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: int
    customer_name: str
    customer_email: str | None
    order_channel: OrderChannel
    order_status: OrderStatus
    order_type: OrderType
    payment_method_intent: str | None = None
    reference_code: str | None = None
    pickup_code: str | None = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    amount_tendered: Decimal | None = None
    change_due: Decimal | None = None
    receipt_pdf_url: str | None = None
    order_date: datetime
    expires_at: datetime | None = None
    picked_up_at: datetime | None = None
    items: list[OrderItemResponse] = Field(default_factory=list)


class OrderTrackingResponse(BaseModel):
    order_id: int
    order_status: OrderStatus
    order_type: OrderType
    total_amount: Decimal
    reference_code: str | None = None
    pickup_code: str | None = None
    receipt_pdf_url: str | None = None
    order_date: datetime
    expires_at: datetime | None = None
    picked_up_at: datetime | None = None
    customer_name: str
    items: list[OrderItemResponse] = Field(default_factory=list)


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: str | OrderStatus) -> str | OrderStatus:
        if isinstance(value, str):
            return value.lower()
        return value
