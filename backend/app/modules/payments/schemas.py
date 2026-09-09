from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.payments.models import PaymentMethod, PaymentStatus


class CustomerPaymentRequest(BaseModel):
    email: EmailStr
    payment_method: PaymentMethod = PaymentMethod.CARD
    idempotency_key: str = Field(min_length=8, max_length=100, description="Client generated UUID for idempotent payments")


class PayAtCounterRequest(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.CASH
    amount_tendered: Decimal | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_id: int
    order_id: int
    payment_method: PaymentMethod
    amount_paid: Decimal
    amount_tendered: Decimal | None = None
    change_due: Decimal | None = None
    receipt_pdf_url: str | None = None
    payment_status: PaymentStatus
    transaction_reference: str | None = None
    paid_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ReceiptResponse(BaseModel):
    order_id: int
    receipt_pdf_url: str
    generated_at: datetime
