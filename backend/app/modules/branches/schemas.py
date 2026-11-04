from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    address: str = Field(..., min_length=3, max_length=255)
    timezone: str = Field(default="Asia/Manila")
    is_active: bool = True
    operational_settings: str | None = None


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    address: str | None = Field(default=None, min_length=3, max_length=255)
    timezone: str | None = None
    is_active: bool | None = None
    operational_settings: str | None = None


class BranchResponse(BranchBase):
    branch_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BranchTransferItemCreate(BaseModel):
    inventory_item_id: int
    quantity: Decimal = Field(..., gt=0)


class BranchTransferItemResponse(BaseModel):
    transfer_item_id: int
    inventory_item_id: int
    item_name: str | None = None
    quantity: Decimal

    model_config = ConfigDict(from_attributes=True)


class BranchTransferCreate(BaseModel):
    source_branch_id: int
    destination_branch_id: int
    notes: str | None = None
    items: list[BranchTransferItemCreate] = Field(..., min_length=1)


class BranchTransferResponse(BaseModel):
    transfer_id: int
    source_branch_id: int
    destination_branch_id: int
    source_branch_name: str | None = None
    destination_branch_name: str | None = None
    status: str
    requested_by_user_id: int
    approved_by_user_id: int | None = None
    notes: str | None = None
    created_at: datetime
    items: list[BranchTransferItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
