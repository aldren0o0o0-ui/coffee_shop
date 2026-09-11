from __future__ import annotations

import logging
import random
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.core.rate_limit import check_payment_attempt_rate_limit
from app.modules.customers import service as customers_service
from app.modules.inventory.service import (
    InsufficientStockError,
    deduct_inventory_for_order,
)
from app.modules.menu.models import MenuItem, MenuItemIngredient
from app.modules.orders.models import Order, OrderItem, OrderItemAddon, OrderStatus
from app.modules.payments.models import Payment, PaymentMethod, PaymentStatus
from app.modules.payments.receipt import generate_receipt_pdf
from app.modules.payments.schemas import CustomerPaymentRequest, PayAtCounterRequest
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """Normalize database timestamps returned without timezone information."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def generate_unique_pickup_code(database: Session) -> str:
    """
    Generates a unique 2-letter + 4-digit pickup code (e.g. BF-4892) scoped to today's orders.
    Retries up to 5 times on collision.
    """
    today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    for _ in range(5):
        random_digits = f"{random.randint(1000, 9999)}"
        code = f"BF-{random_digits}"

        existing = database.scalar(
            select(Order.order_id)
            .where(
                Order.pickup_code == code,
                Order.order_date >= today_start,
            )
            .limit(1)
        )

        if existing is None:
            return code

    random_digits = f"{random.randint(100000, 999999)}"
    logger.warning("Pickup code collision fallback to 6 digits triggered.")
    return f"BF-{random_digits}"


def validate_cash_tender(amount_due: Decimal, amount_tendered: Decimal | None) -> tuple[Decimal, Decimal]:
    """
    Validates that cash tendered is at least the total amount due.
    If amount_tendered is None, defaults to exact cash (amount_due).
    Returns (amount_tendered, change_due).
    """
    if amount_tendered is None:
        amount_tendered = amount_due

    if amount_tendered < amount_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Amount tendered (₱{amount_tendered:.2f}) must be at least total due (₱{amount_due:.2f}).",
        )
    change_due = amount_tendered - amount_due
    return amount_tendered, change_due


def get_payment_by_id(database: Session, payment_id: int) -> Payment | None:
    return database.get(Payment, payment_id)


def get_order_payments(database: Session, order_id: int) -> Sequence[Payment]:
    stmt = (
        select(Payment)
        .where(Payment.order_id == order_id)
        .order_by(Payment.created_at.asc())
    )
    return database.scalars(stmt).all()


def find_payment_by_transaction_reference(database: Session, reference: str) -> Payment | None:
    stmt = (
        select(Payment)
        .where(Payment.transaction_reference == reference)
        .limit(1)
    )
    return database.scalar(stmt)


def process_customer_payment(
    database: Session,
    order_id: int,
    payment_data: CustomerPaymentRequest,
    client_ip: str | None,
) -> Order:
    """
    Executes customer online payment settlement:
    - Rate limit check
    - Order row-level locking (FOR UPDATE)
    - Ownership verification
    - Idempotency guard (prevents double charges)
    - Expiry validation
    - Inventory stock deduction with row-level locks
    - Payment recording (COMPLETED or FAILED)
    - Single-use pickup code generation & status transition to CONFIRMED
    - Thermal receipt PDF generation
    """
    # 1. Rate Limiting Check on Payment Attempts
    if not check_payment_attempt_rate_limit(order_id, client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many payment attempts. Please wait a few minutes before retrying.",
        )

    # SQLite ignores SELECT ... FOR UPDATE. Begin an immediate transaction so
    # local/test deployments retain the same settlement serialization that
    # PostgreSQL provides through row locks in production.
    if database.bind and database.bind.dialect.name == "sqlite":
        database.execute(text("BEGIN IMMEDIATE"))

    # 2. Query Order with items and customer (using FOR UPDATE to serialize payment attempts)
    statement = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items)
            .selectinload(OrderItem.menu_item)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item),
            selectinload(Order.order_items).selectinload(OrderItem.addons),
            selectinload(Order.payments),
        )
        .where(Order.order_id == order_id)
        .with_for_update()
    )
    order = database.scalar(statement)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # Ownership verification (must match customer email)
    if not order.customer or order.customer.email.strip().lower() != payment_data.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # 3. Idempotency Check
    existing_payment = database.scalar(
        select(Payment)
        .where(
            Payment.order_id == order.order_id,
            Payment.transaction_reference == payment_data.idempotency_key,
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
        .limit(1)
    )
    if existing_payment and order.order_status != OrderStatus.AWAITING_PAYMENT:
        logger.info(f"Idempotent payment match for order {order_id}. Returning existing confirmed order.")
        return order

    # 4. Check Expiry
    now = utc_now()
    if (order.expires_at and as_utc(order.expires_at) < now) or order.order_status == OrderStatus.EXPIRED:
        order.order_status = OrderStatus.EXPIRED
        database.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This order reservation has expired (10-minute limit). Please return to the menu to place a fresh order.",
        )

    if order.order_status != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is already in status '{order.order_status.value}' and cannot be paid again.",
        )

    # 5. Concurrency & Row-Level Locking on Inventory Items
    try:
        deduct_inventory_for_order(
            database=database,
            order_items=order.order_items,
            order_id=order.order_id,
            created_by_user_id=order.user_id or 1,
            now=now,
            reference_type="order",
            note_prefix="Order",
        )
    except InsufficientStockError as err:
        # Mark payment attempt as failed and commit
        failed_payment = Payment(
            order_id=order.order_id,
            payment_method=payment_data.payment_method,
            amount_paid=order.total_amount,
            payment_status=PaymentStatus.FAILED,
            transaction_reference=payment_data.idempotency_key,
            paid_at=now,
        )
        database.add(failed_payment)
        database.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"We apologize, '{err.item_name}' just sold out. Please select an alternative drink.",
        )

    # 6. Record Payment as COMPLETED
    payment = Payment(
        order_id=order.order_id,
        payment_method=payment_data.payment_method,
        amount_paid=order.total_amount,
        payment_status=PaymentStatus.COMPLETED,
        transaction_reference=payment_data.idempotency_key,
        paid_at=now,
    )
    database.add(payment)
    database.flush()

    # 7. Generate Single-Use Pickup Code and Set Status to CONFIRMED (Layer 3)
    pickup_code = generate_unique_pickup_code(database)
    order.pickup_code = pickup_code
    order.pickup_code_expires_at = now + timedelta(hours=4)
    order.order_status = OrderStatus.CONFIRMED

    # 8. Generate Immutable Thermal Receipt PDF
    try:
        receipt_url = generate_receipt_pdf(order, payment)
        payment.receipt_pdf_url = receipt_url
    except Exception as exc:
        logger.error(f"Failed to generate receipt PDF for order #{order.order_id}: {exc}")

    # 9. Dispatch Customer Receipt & Pickup Code Email
    if order.customer and order.customer.email:
        try:
            from app.shared.email_service import send_payment_receipt_email
            send_payment_receipt_email(order, payment, order.customer.email, run_async=True)
            payment.receipt_emailed_at = now
        except Exception as exc:
            payment.receipt_email_last_error = str(exc)
            logger.error(f"Failed to dispatch receipt email for order #{order.order_id}: {exc}")

    database.commit()
    database.refresh(order)
    logger.info(f"Order #{order.order_id} successfully paid and confirmed. Pickup code: {pickup_code}")
    return order


def process_pay_at_counter(
    database: Session,
    order_id: int,
    payload: PayAtCounterRequest,
    cashier_user: User,
) -> Order:
    """
    Cashier confirms cash or card payment for a Pay-at-Counter pending order.
    Deducts inventory with row-level locks, sets status to CONFIRMED, generates single-use pickup code & thermal receipt PDF.
    """
    now = utc_now()

    stmt = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item),
            selectinload(Order.order_items).selectinload(OrderItem.menu_item_size),
            selectinload(Order.order_items).selectinload(OrderItem.addons).selectinload(OrderItemAddon.menu_item_addon),
        )
        .where(Order.order_id == order_id)
    )
    order = database.scalar(stmt)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order.order_status != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is already in '{order.order_status.value}' status.",
        )

    if order.expires_at and as_utc(order.expires_at) < now:
        order.order_status = OrderStatus.EXPIRED
        if order.customer:
            customers_service.record_customer_no_show(database, order.customer)
        database.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This order reservation has expired. Please recreate it in POS.",
        )

    # If cashier updated order items before payment, recalculate items & totals first
    if payload.items:
        from app.modules.orders.service import update_order_items_and_totals
        update_order_items_and_totals(database, order, payload.items)
        database.expire(order, ["order_items"])

    # Cash validation
    amount_tendered = None
    change_due = None
    if payload.payment_method == PaymentMethod.CASH:
        amount_tendered, change_due = validate_cash_tender(order.total_amount, payload.amount_tendered)

    # Deduct inventory atomically
    try:
        deduct_inventory_for_order(
            database=database,
            order_items=order.order_items,
            order_id=order.order_id,
            created_by_user_id=cashier_user.user_id,
            now=now,
            reference_type="counter_pay",
            note_prefix="Counter Pay Order",
        )
    except InsufficientStockError as err:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot complete payment: '{err.item_name}' is out of stock.",
        )

    pickup_code = generate_unique_pickup_code(database)

    order.order_status = OrderStatus.CONFIRMED
    order.pickup_code = pickup_code
    order.pickup_code_expires_at = now + timedelta(hours=4)
    order.user_id = cashier_user.user_id

    payment = Payment(
        order_id=order.order_id,
        payment_method=payload.payment_method,
        amount_paid=order.total_amount,
        amount_tendered=amount_tendered,
        change_due=change_due,
        payment_status=PaymentStatus.COMPLETED,
        transaction_reference=f"COUNTER-{order.reference_code or order.order_id}-{now.strftime('%Y%m%d%H%M%S')}",
        paid_at=now,
    )
    database.add(payment)
    database.flush()

    try:
        receipt_url = generate_receipt_pdf(order, payment)
        payment.receipt_pdf_url = receipt_url
    except Exception as exc:
        logger.error(f"Failed to generate receipt PDF for counter order #{order.order_id}: {exc}")

    # Dispatch Customer Receipt & Pickup Code Email
    if order.customer and order.customer.email:
        try:
            from app.shared.email_service import send_payment_receipt_email
            send_payment_receipt_email(order, payment, order.customer.email, run_async=True)
            payment.receipt_emailed_at = now
        except Exception as exc:
            payment.receipt_email_last_error = str(exc)
            logger.error(f"Failed to dispatch receipt email for counter order #{order.order_id}: {exc}")

    database.commit()
    database.refresh(order)
    return order


def create_pos_payment(
    database: Session,
    order: Order,
    payment_method: PaymentMethod,
    total_amount: Decimal,
    amount_tendered: Decimal | None,
    now: datetime,
) -> Payment:
    """
    Creates and records a completed POS payment with cash change calculations and receipt PDF generation.
    Must be called inside an active transaction.
    """
    change_due = Decimal("0.00")
    if payment_method == PaymentMethod.CASH:
        if amount_tendered is not None:
            amount_tendered, change_due = validate_cash_tender(total_amount, amount_tendered)
        else:
            amount_tendered = total_amount
            change_due = Decimal("0.00")

    payment = Payment(
        order_id=order.order_id,
        payment_method=payment_method,
        amount_paid=total_amount,
        amount_tendered=amount_tendered,
        change_due=change_due,
        payment_status=PaymentStatus.COMPLETED,
        transaction_reference=f"POS-TILL-{now.strftime('%Y%m%d%H%M%S')}",
        paid_at=now,
    )
    database.add(payment)
    database.flush()

    try:
        receipt_url = generate_receipt_pdf(order, payment)
        payment.receipt_pdf_url = receipt_url
    except Exception as exc:
        logger.error(f"Failed to generate POS receipt PDF for order #{order.order_id}: {exc}")

    # Dispatch Customer Receipt & Pickup Code Email if customer email is provided
    if order.customer and order.customer.email:
        try:
            from app.shared.email_service import send_payment_receipt_email
            send_payment_receipt_email(order, payment, order.customer.email, run_async=True)
            payment.receipt_emailed_at = now
        except Exception as exc:
            payment.receipt_email_last_error = str(exc)
            logger.error(f"Failed to dispatch POS receipt email for order #{order.order_id}: {exc}")

    return payment
