from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.customers.models import LoyaltyTransactionType


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    loyalty_points_balance: int = 0
    is_guest: bool = True
    is_blocked: bool = False
    no_show_count: int = 0
    registered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


CustomerLookupResponse = CustomerResponse


class CustomerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    loyalty_points_balance: int = 0
    is_guest: bool = True
    is_blocked: bool = False
    registered_at: datetime | None = None


class CustomerUpdateRequest(BaseModel):
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    phone_number: str | None = Field(default=None, max_length=20)


class CustomerBlockRequest(BaseModel):
    is_blocked: bool = True
    reason: str | None = None


class LoyaltyTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    loyalty_transaction_id: int
    customer_id: int
    order_id: int | None = None
    transaction_type: LoyaltyTransactionType
    points: int
    description: str | None = None
    transaction_date: datetime
    created_at: datetime


class LoyaltyBalanceResponse(BaseModel):
    customer_id: int
    loyalty_points_balance: int
    recent_transactions: list[LoyaltyTransactionResponse] = []


class LoyaltyAdjustmentRequest(BaseModel):
    points: int = Field(..., description="Points to add (positive) or deduct (negative), non-zero")
    description: str = Field(..., min_length=1, max_length=255, description="Reason for the manual adjustment")


class LoyaltyRedeemRequest(BaseModel):
    points: int = Field(..., gt=0, description="Positive number of points to redeem")
    order_id: int | None = Field(default=None, description="Associated order ID if applicable")
    description: str | None = Field(default=None, max_length=255)
