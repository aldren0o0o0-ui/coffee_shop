from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.modules.auth.dependencies import (
    CurrentAuthenticationDependency,
)
from app.modules.customers import service
from app.modules.customers.schemas import (
    CustomerBlockRequest,
    CustomerLookupResponse,
    CustomerProfileResponse,
    CustomerResponse,
    CustomerUpdateRequest,
    LoyaltyAdjustmentRequest,
    LoyaltyBalanceResponse,
    LoyaltyRedeemRequest,
    LoyaltyTransactionResponse,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/customers",
    tags=["Customers & Loyalty"],
)


@router.get("/lookup", response_model=CustomerResponse | None)
def lookup_customer(
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
    email: Annotated[str | None, Query()] = None,
    phone: Annotated[str | None, Query()] = None,
) -> CustomerResponse | None:
    if email:
        customer = service.find_customer_by_email(database, email)
        if customer:
            return customer
    if phone:
        customer = service.find_customer_by_phone(database, phone)
        if customer:
            return customer
    return None


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
) -> CustomerResponse:
    customer = service.get_customer_by_id(database, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer_profile(
    customer_id: int,
    payload: CustomerUpdateRequest,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
) -> CustomerResponse:
    return service.update_customer_profile(
        database=database,
        customer_id=customer_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_number=payload.phone_number,
    )


@router.patch("/{customer_id}/block", response_model=CustomerResponse)
def toggle_customer_block(
    customer_id: int,
    payload: CustomerBlockRequest,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
) -> CustomerResponse:
    # Restrict to manager or owner
    roles = [r.role.role_name.lower() for r in current_auth.user.user_roles if r.is_active and r.role.is_active]
    if not ({"manager", "owner"} & set(roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and owners can block or unblock customers.",
        )
    return service.set_customer_blocked_status(
        database=database,
        customer_id=customer_id,
        is_blocked=payload.is_blocked,
    )


@router.get("/{customer_id}/loyalty", response_model=LoyaltyBalanceResponse)
def get_customer_loyalty(
    customer_id: int,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LoyaltyBalanceResponse:
    customer = service.get_customer_by_id(database, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    transactions = service.list_loyalty_transactions(database, customer_id, limit=limit)
    return LoyaltyBalanceResponse(
        customer_id=customer.customer_id,
        loyalty_points_balance=customer.loyalty_points_balance,
        recent_transactions=[LoyaltyTransactionResponse.model_validate(t) for t in transactions],
    )


@router.post("/{customer_id}/loyalty/adjust", response_model=LoyaltyTransactionResponse)
def adjust_customer_loyalty(
    customer_id: int,
    payload: LoyaltyAdjustmentRequest,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
) -> LoyaltyTransactionResponse:
    roles = [r.role.role_name.lower() for r in current_auth.user.user_roles if r.is_active and r.role.is_active]
    if not ({"manager", "owner"} & set(roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and owners can perform manual loyalty adjustments.",
        )
    transaction = service.adjust_loyalty_points(
        database=database,
        customer_id=customer_id,
        points=payload.points,
        description=payload.description,
    )
    return LoyaltyTransactionResponse.model_validate(transaction)


@router.post("/{customer_id}/loyalty/redeem", response_model=LoyaltyTransactionResponse)
def redeem_customer_loyalty(
    customer_id: int,
    payload: LoyaltyRedeemRequest,
    database: DatabaseDependency,
    current_auth: CurrentAuthenticationDependency,
) -> LoyaltyTransactionResponse:
    transaction = service.redeem_loyalty_points(
        database=database,
        customer_id=customer_id,
        order_id=payload.order_id,
        points=payload.points,
        description=payload.description,
    )
    database.commit()
    database.refresh(transaction)
    return LoyaltyTransactionResponse.model_validate(transaction)
