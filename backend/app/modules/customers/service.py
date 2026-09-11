from __future__ import annotations

import logging
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.customers.models import (
    Customer,
    LoyaltyTransaction,
    LoyaltyTransactionType,
)

logger = logging.getLogger(__name__)


def normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    cleaned = email.strip().lower()
    return cleaned if cleaned else None


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    cleaned = phone.strip()
    return cleaned if cleaned else None


def get_customer_by_id(database: Session, customer_id: int) -> Customer | None:
    return database.get(Customer, customer_id)


def find_customer_by_email(database: Session, email: str) -> Customer | None:
    norm_email = normalize_email(email)
    if not norm_email:
        return None
    return database.scalar(
        select(Customer)
        .where(func.lower(Customer.email) == norm_email)
        .limit(1)
    )


def find_customer_by_phone(database: Session, phone_number: str) -> Customer | None:
    norm_phone = normalize_phone(phone_number)
    if not norm_phone:
        return None
    return database.scalar(
        select(Customer)
        .where(Customer.phone_number == norm_phone)
        .limit(1)
    )


def ensure_customer_can_order(customer: Customer | None) -> None:
    """
    Validates whether the customer is allowed to place online orders.
    Raises HTTP 403 if the customer is blocked.
    """
    if customer and customer.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Online ordering is temporarily unavailable — please visit our store to place an order.",
        )


def record_customer_no_show(database: Session, customer: Customer) -> Customer:
    """
    Increments no_show_count on customer and blocks if threshold reached (>= 5).
    """
    customer.no_show_count = (customer.no_show_count or 0) + 1
    if customer.no_show_count >= 5:
        customer.is_blocked = True
        logger.warning(f"Customer #{customer.customer_id} automatically blocked due to {customer.no_show_count} no-shows.")
    return customer


def resolve_customer(
    database: Session,
    first_name: str | None,
    last_name: str | None = None,
    email: str | None = None,
    phone_number: str | None = None,
    is_guest: bool = True,
) -> Customer:
    """
    Finds an existing customer by email (or phone), or creates a new one.
    Updates names if provided. Prevents duplicate phone unique constraint collisions.
    """
    norm_email = normalize_email(email)
    norm_phone = normalize_phone(phone_number)

    customer: Customer | None = None
    if norm_email:
        customer = find_customer_by_email(database, norm_email)
    elif norm_phone:
        customer = find_customer_by_phone(database, norm_phone)

    if customer:
        if first_name and first_name.strip():
            customer.first_name = first_name.strip()
        if last_name and last_name.strip():
            customer.last_name = last_name.strip()
        if norm_phone and not customer.phone_number:
            # Check phone uniqueness
            phone_claimed = database.scalar(
                select(Customer.customer_id)
                .where(Customer.phone_number == norm_phone, Customer.customer_id != customer.customer_id)
                .limit(1)
            )
            if not phone_claimed:
                customer.phone_number = norm_phone
        return customer

    # Check phone uniqueness before creating new customer
    phone_to_use = norm_phone
    if norm_phone:
        phone_claimed = database.scalar(
            select(Customer.customer_id)
            .where(Customer.phone_number == norm_phone)
            .limit(1)
        )
        if phone_claimed:
            phone_to_use = None

    customer = Customer(
        first_name=first_name.strip() if first_name else None,
        last_name=last_name.strip() if last_name else None,
        email=norm_email,
        phone_number=phone_to_use,
        is_guest=is_guest,
        is_blocked=False,
        no_show_count=0,
        loyalty_points_balance=0,
    )
    database.add(customer)
    database.flush()
    return customer


def update_customer_profile(
    database: Session,
    customer_id: int,
    first_name: str | None = None,
    last_name: str | None = None,
    phone_number: str | None = None,
) -> Customer:
    customer = database.get(Customer, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    if first_name is not None:
        customer.first_name = first_name.strip() if first_name.strip() else None
    if last_name is not None:
        customer.last_name = last_name.strip() if last_name.strip() else None
    if phone_number is not None:
        norm_phone = normalize_phone(phone_number)
        if norm_phone:
            phone_claimed = database.scalar(
                select(Customer.customer_id)
                .where(Customer.phone_number == norm_phone, Customer.customer_id != customer.customer_id)
                .limit(1)
            )
            if phone_claimed:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This phone number is already registered to another customer.",
                )
        customer.phone_number = norm_phone

    database.commit()
    database.refresh(customer)
    return customer


def set_customer_blocked_status(
    database: Session,
    customer_id: int,
    is_blocked: bool,
) -> Customer:
    customer = database.get(Customer, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    customer.is_blocked = is_blocked
    database.commit()
    database.refresh(customer)
    return customer


# ==========================================
# Loyalty Subdomain Operations
# ==========================================

def get_loyalty_balance(database: Session, customer_id: int) -> int:
    customer = database.get(Customer, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return customer.loyalty_points_balance


def list_loyalty_transactions(
    database: Session,
    customer_id: int,
    limit: int = 50,
) -> Sequence[LoyaltyTransaction]:
    statement = (
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.customer_id == customer_id)
        .order_by(LoyaltyTransaction.transaction_date.desc(), LoyaltyTransaction.loyalty_transaction_id.desc())
        .limit(limit)
    )
    return database.scalars(statement).all()


def earn_loyalty_points(
    database: Session,
    customer_id: int,
    order_id: int | None,
    points: int,
    description: str | None = None,
) -> LoyaltyTransaction:
    """
    Awards loyalty points to a customer and creates a ledger record.
    Must be called within a database transaction.
    """
    if points <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Earned points must be a positive integer.",
        )

    # Lock customer row for atomic update
    customer = database.scalar(
        select(Customer)
        .where(Customer.customer_id == customer_id)
        .with_for_update()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    customer.loyalty_points_balance = (customer.loyalty_points_balance or 0) + points

    transaction = LoyaltyTransaction(
        customer_id=customer.customer_id,
        order_id=order_id,
        transaction_type=LoyaltyTransactionType.EARN,
        points=points,
        description=description or (f"Earned points for order #{order_id}" if order_id else "Earned points"),
    )
    database.add(transaction)
    database.flush()
    return transaction


def redeem_loyalty_points(
    database: Session,
    customer_id: int,
    order_id: int | None,
    points: int,
    description: str | None = None,
) -> LoyaltyTransaction:
    """
    Redeems loyalty points from a customer. Ensures balance does not go below zero.
    Must be called within a database transaction.
    """
    if points <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Redeemed points must be a positive integer.",
        )

    # Lock customer row for atomic balance check & deduction
    customer = database.scalar(
        select(Customer)
        .where(Customer.customer_id == customer_id)
        .with_for_update()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    if (customer.loyalty_points_balance or 0) < points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient loyalty points. Balance: {customer.loyalty_points_balance}, Required: {points}.",
        )

    customer.loyalty_points_balance -= points

    transaction = LoyaltyTransaction(
        customer_id=customer.customer_id,
        order_id=order_id,
        transaction_type=LoyaltyTransactionType.REDEEM,
        points=-points,
        description=description or (f"Redeemed points on order #{order_id}" if order_id else "Redeemed points"),
    )
    database.add(transaction)
    database.flush()
    return transaction


def adjust_loyalty_points(
    database: Session,
    customer_id: int,
    points: int,
    description: str,
) -> LoyaltyTransaction:
    """
    Manually adjusts loyalty points balance with mandatory description.
    """
    if points == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adjustment points cannot be zero.",
        )

    if not description or not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty description is required for manual loyalty adjustments.",
        )

    customer = database.scalar(
        select(Customer)
        .where(Customer.customer_id == customer_id)
        .with_for_update()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    new_balance = (customer.loyalty_points_balance or 0) + points
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment would cause negative balance ({new_balance}). Current balance is {customer.loyalty_points_balance}.",
        )

    customer.loyalty_points_balance = new_balance

    transaction = LoyaltyTransaction(
        customer_id=customer.customer_id,
        order_id=None,
        transaction_type=LoyaltyTransactionType.ADJUSTMENT,
        points=points,
        description=description.strip(),
    )
    database.add(transaction)
    database.commit()
    database.refresh(transaction)
    return transaction
