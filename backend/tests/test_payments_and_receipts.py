import os
import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import app
from app.modules.orders.models import (
    Order,
    OrderChannel,
    OrderItem,
    OrderStatus,
    OrderType,
)
from app.modules.customers import service as customers_service
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory, MenuItem, MenuItemIngredient
from app.modules.payments.models import Payment, PaymentMethod, PaymentStatus
from app.modules.payments.receipt import generate_receipt_pdf
from app.modules.payments import service as payments_service
from app.modules.payments.schemas import CustomerPaymentRequest, PayAtCounterRequest
from app.modules.users.models import Role, User, UserRole
from app.core.security import hash_password

client = TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def create_or_get_staff_auth_cookie(session, role_name="Cashier") -> dict:
    role = session.scalar(select(Role).where(Role.role_name == role_name))
    if not role:
        role = Role(role_name=role_name, description=f"{role_name} Role")
        session.add(role)
        session.flush()

    username = f"test_payment_{role_name.lower()}"
    user = session.scalar(select(User).where(User.username == username))
    if not user:
        user = User(
            username=username,
            first_name="Test",
            last_name=role_name,
            email=f"{username}@coffee.local",
            password_hash=hash_password("PaymentPass123!"),
            is_active=True,
            must_change_password=False,
        )
        session.add(user)
        session.flush()

        ur = UserRole(user_id=user.user_id, role_id=role.role_id, is_active=True)
        session.add(ur)
        session.commit()

    resp = client.post("/api/v1/auth/login", json={"identifier": username, "password": "PaymentPass123!"})
    assert resp.status_code == 200
    return resp.cookies


def setup_order_for_payment(db, stock_kg=Decimal("10.000"), price=Decimal("4.50")):
    u = uuid.uuid4().hex[:6]
    category = db.scalar(select(MenuCategory).where(MenuCategory.category_name == "Payment Category"))
    if not category:
        category = MenuCategory(category_name="Payment Category", display_order=1)
        db.add(category)
        db.flush()

    inv_item = InventoryItem(
        item_name=f"Payment Beans {u}",
        unit_of_measure="kg",
        quantity_on_hand=stock_kg,
        reorder_level=Decimal("1.000"),
    )
    db.add(inv_item)
    db.flush()

    menu_item = MenuItem(
        category_id=category.category_id,
        item_name=f"Payment Americano {u}",
        base_price=price,
        is_available=True,
    )
    db.add(menu_item)
    db.flush()

    recipe = MenuItemIngredient(
        menu_item_id=menu_item.menu_item_id,
        inventory_item_id=inv_item.inventory_item_id,
        quantity_required=Decimal("0.020"),
        unit_of_measure="kg",
    )
    db.add(recipe)
    db.flush()

    customer = customers_service.resolve_customer(
        database=db,
        first_name="PayUser",
        email=f"payuser_{u}@example.com",
    )
    db.flush()

    order = Order(
        customer_id=customer.customer_id,
        order_channel=OrderChannel.ONLINE,
        order_status=OrderStatus.AWAITING_PAYMENT,
        order_type=OrderType.TAKEOUT,
        subtotal=price,
        tax_amount=Decimal("0.36"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("4.86"),
    )
    db.add(order)
    db.flush()

    order_item = OrderItem(
        order_id=order.order_id,
        menu_item_id=menu_item.menu_item_id,
        quantity=1,
        unit_price=price,
        subtotal=price,
    )
    db.add(order_item)
    db.commit()
    db.refresh(order)
    return order, customer, inv_item


def test_cash_tender_validation_and_change_calculation():
    # Exact tender
    tendered, change = payments_service.validate_cash_tender(Decimal("15.50"), Decimal("15.50"))
    assert tendered == Decimal("15.50")
    assert change == Decimal("0.00")

    # Excess tender
    tendered, change = payments_service.validate_cash_tender(Decimal("15.50"), Decimal("20.00"))
    assert tendered == Decimal("20.00")
    assert change == Decimal("4.50")

    # Insufficient tender
    with pytest.raises(HTTPException) as exc_info:
        payments_service.validate_cash_tender(Decimal("15.50"), Decimal("10.00"))
    assert exc_info.value.status_code == 400
    assert "Amount tendered ($10.00) must be at least total due ($15.50)" in str(exc_info.value.detail)


def test_successful_online_payment_and_receipt_generation(db_session):
    order, customer, inv_item = setup_order_for_payment(db_session, stock_kg=Decimal("5.000"))
    initial_stock = inv_item.quantity_on_hand

    idempotency_key = str(uuid.uuid4())
    req = CustomerPaymentRequest(
        email=customer.email,
        payment_method=PaymentMethod.CARD,
        idempotency_key=idempotency_key,
    )

    paid_order = payments_service.process_customer_payment(
        database=db_session,
        order_id=order.order_id,
        payment_data=req,
        client_ip="127.0.0.1",
    )

    assert paid_order.order_status == OrderStatus.CONFIRMED
    assert paid_order.pickup_code is not None

    # Verify inventory was deducted (recipe = 0.020 kg)
    db_session.refresh(inv_item)
    assert inv_item.quantity_on_hand == initial_stock - Decimal("0.020")

    # Verify Payment record
    payment = db_session.scalar(select(Payment).where(Payment.order_id == order.order_id))
    assert payment is not None
    assert payment.payment_status == PaymentStatus.COMPLETED
    assert payment.payment_method == PaymentMethod.CARD
    assert payment.amount_paid == order.total_amount
    assert payment.transaction_reference == idempotency_key
    assert payment.receipt_pdf_url is not None

    # Verify physical receipt PDF exists and has valid PDF signature
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    rel_path = payment.receipt_pdf_url.lstrip("/").replace("/", os.sep)
    abs_pdf_path = os.path.join(base_dir, "backend", rel_path)
    if not os.path.exists(abs_pdf_path):
        abs_pdf_path = os.path.join(base_dir, rel_path)

    assert os.path.exists(abs_pdf_path), f"Receipt PDF file missing at {abs_pdf_path}"
    with open(abs_pdf_path, "rb") as f:
        header = f.read(5)
        assert header == b"%PDF-", "File must start with standard PDF header"


def test_failed_payment_on_insufficient_inventory_and_no_receipt(db_session):
    # Setup order where stock is 0.000
    order, customer, inv_item = setup_order_for_payment(db_session, stock_kg=Decimal("0.000"))

    idempotency_key = str(uuid.uuid4())
    req = CustomerPaymentRequest(
        email=customer.email,
        payment_method=PaymentMethod.CARD,
        idempotency_key=idempotency_key,
    )

    with pytest.raises(HTTPException) as exc_info:
        payments_service.process_customer_payment(
            database=db_session,
            order_id=order.order_id,
            payment_data=req,
            client_ip="127.0.0.1",
        )
    assert exc_info.value.status_code == 400
    assert "sold out" in str(exc_info.value.detail).lower()

    # Verify FAILED Payment record was saved with no receipt
    failed_payment = db_session.scalar(select(Payment).where(Payment.order_id == order.order_id))
    assert failed_payment is not None
    assert failed_payment.payment_status == PaymentStatus.FAILED
    assert failed_payment.receipt_pdf_url is None

    # Order remains AWAITING_PAYMENT (not confirmed)
    db_session.refresh(order)
    assert order.order_status == OrderStatus.AWAITING_PAYMENT
    assert order.pickup_code is None


def test_payment_idempotency_duplicate_guard(db_session):
    order, customer, inv_item = setup_order_for_payment(db_session, stock_kg=Decimal("5.000"))
    initial_stock = inv_item.quantity_on_hand

    idempotency_key = str(uuid.uuid4())
    req = CustomerPaymentRequest(
        email=customer.email,
        payment_method=PaymentMethod.CARD,
        idempotency_key=idempotency_key,
    )

    # First payment attempt
    paid_order1 = payments_service.process_customer_payment(
        database=db_session,
        order_id=order.order_id,
        payment_data=req,
        client_ip="127.0.0.1",
    )
    assert paid_order1.order_status == OrderStatus.CONFIRMED

    # Second payment attempt with exact same idempotency_key
    paid_order2 = payments_service.process_customer_payment(
        database=db_session,
        order_id=order.order_id,
        payment_data=req,
        client_ip="127.0.0.1",
    )
    assert paid_order2.order_id == paid_order1.order_id

    # Verify only 1 payment was created (no double charge)
    payments = db_session.scalars(select(Payment).where(Payment.order_id == order.order_id)).all()
    assert len(payments) == 1

    # Verify inventory was deducted only ONCE
    db_session.refresh(inv_item)
    assert inv_item.quantity_on_hand == initial_stock - Decimal("0.020")


def test_pay_at_counter_settlement(db_session):
    order, customer, inv_item = setup_order_for_payment(db_session, stock_kg=Decimal("5.000"))
    order.payment_method_intent = "pay_at_counter"
    order.reference_code = "REF-9988"
    db_session.commit()

    cashier = db_session.scalar(select(User).where(User.username == "test_payment_cashier"))
    if not cashier:
        create_or_get_staff_auth_cookie(db_session, "Cashier")
        cashier = db_session.scalar(select(User).where(User.username == "test_payment_cashier"))

    payload = PayAtCounterRequest(
        payment_method=PaymentMethod.CASH,
        amount_tendered=Decimal("10.00"),
    )

    confirmed_order = payments_service.process_pay_at_counter(
        database=db_session,
        order_id=order.order_id,
        payload=payload,
        cashier_user=cashier,
    )

    assert confirmed_order.order_status == OrderStatus.CONFIRMED
    assert confirmed_order.pickup_code is not None

    payment = db_session.scalar(select(Payment).where(Payment.order_id == order.order_id))
    assert payment is not None
    assert payment.payment_status == PaymentStatus.COMPLETED
    assert payment.payment_method == PaymentMethod.CASH
    assert payment.amount_paid == order.total_amount
    assert payment.amount_tendered == Decimal("10.00")
    assert payment.change_due == Decimal("10.00") - order.total_amount
    assert payment.receipt_pdf_url is not None


def test_payments_api_routes_integration(db_session):
    cookies = create_or_get_staff_auth_cookie(db_session, "Manager")
    order, customer, _ = setup_order_for_payment(db_session, stock_kg=Decimal("5.000"))

    # Execute payment via service
    req = CustomerPaymentRequest(
        email=customer.email,
        payment_method=PaymentMethod.CARD,
        idempotency_key=str(uuid.uuid4()),
    )
    payments_service.process_customer_payment(
        database=db_session,
        order_id=order.order_id,
        payment_data=req,
        client_ip="127.0.0.1",
    )

    # 1. Test GET /payments/order/{order_id}
    res = client.get(f"/api/v1/payments/order/{order.order_id}", cookies=cookies)
    assert res.status_code == 200
    payments_data = res.json()
    assert len(payments_data) >= 1
    payment_id = payments_data[0]["payment_id"]

    # 2. Test GET /payments/{payment_id}
    res_single = client.get(f"/api/v1/payments/{payment_id}", cookies=cookies)
    assert res_single.status_code == 200
    assert res_single.json()["payment_id"] == payment_id
    assert res_single.json()["payment_status"] == "completed"

    # 3. Test GET /payments/receipt/{order_id}
    res_receipt = client.get(f"/api/v1/payments/receipt/{order.order_id}", cookies=cookies)
    assert res_receipt.status_code == 200
    assert res_receipt.json()["order_id"] == order.order_id
    assert res_receipt.json()["receipt_pdf_url"].startswith("/uploads/receipts/")
