import os
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.orders.models import Order, OrderStatus
from app.modules.orders.service import utc_now
from app.modules.users.models import Role, User, UserRole


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


def setup_counter_test_data(db: Session):
    # 1. Category & Menu Item
    cat = db.query(MenuCategory).filter(MenuCategory.category_name == "Coffee").first()
    if not cat:
        cat = MenuCategory(category_name="Coffee", description="Coffee brews", display_order=1, is_active=True)
        db.add(cat)
        db.flush()

    inv_item = db.query(InventoryItem).filter(InventoryItem.item_name == "Counter Test Espresso Beans").first()
    if not inv_item:
        inv_item = InventoryItem(
            item_name="Counter Test Espresso Beans",
            unit_of_measure="kg",
            unit_cost=Decimal("20.00"),
            quantity_on_hand=Decimal("50.000"),
            reorder_level=Decimal("5.000"),
            is_active=True,
        )
        db.add(inv_item)
        db.flush()
    else:
        inv_item.quantity_on_hand = Decimal("50.000")
        db.flush()

    menu_item = db.query(MenuItem).filter(MenuItem.item_name == "Counter Test Latte").first()
    if not menu_item:
        menu_item = MenuItem(
            category_id=cat.category_id,
            item_name="Counter Test Latte",
            description="Espresso with steamed milk",
            base_price=Decimal("4.00"),
            is_available=True,
            is_deleted=False,
            is_draft=False,
        )
        db.add(menu_item)
        db.flush()

        size = MenuItemSize(
            menu_item_id=menu_item.menu_item_id,
            size_name="Regular",
            price_adjustment=Decimal("0.00"),
            is_default=True,
        )
        db.add(size)
        db.flush()

        ing = MenuItemIngredient(
            menu_item_id=menu_item.menu_item_id,
            inventory_item_id=inv_item.inventory_item_id,
            quantity_required=Decimal("0.015"),
            unit_of_measure="kg",
        )
        db.add(ing)
        db.commit()
    else:
        menu_item.is_available = True
        menu_item.is_deleted = False
        db.commit()

    # 2. Cashier user
    cashier_role = db.query(Role).filter(Role.role_name == "Cashier").first()
    if not cashier_role:
        cashier_role = Role(role_name="Cashier", description="Cashier role", is_active=True)
        db.add(cashier_role)
        db.flush()

    cashier_user = db.query(User).filter(User.username == "test_cashier_counter").first()
    if not cashier_user:
        cashier_user = User(
            username="test_cashier_counter",
            email="cashier_counter@brewflow.local",
            password_hash=hash_password("CashierPassword123!"),
            first_name="Stephen",
            last_name="Curry",
            is_active=True,
        )
        db.add(cashier_user)
        db.flush()
        db.add(UserRole(user_id=cashier_user.user_id, role_id=cashier_role.role_id, is_active=True))
        db.commit()

    return menu_item.menu_item_id, cashier_user


def test_complete_pay_at_counter_flow(client: TestClient, db: Session):
    menu_item_id, cashier_user = setup_counter_test_data(db)

    # 1. Customer creates "Pay at Counter" order online
    guest_email = "maria.santos@example.com"
    order_payload = {
        "first_name": "Maria",
        "last_name": "Santos",
        "email": guest_email,
        "phone_number": "09171234567",
        "order_type": "takeout",
        "payment_method_intent": "pay_at_counter",
        "items": [
            {
                "menu_item_id": menu_item_id,
                "quantity": 2,
                "addons": [],
            }
        ],
    }

    create_res = client.post("/api/v1/customer/orders", json=order_payload)
    assert create_res.status_code == 201, create_res.text
    order_data = create_res.json()

    order_id = order_data["order_id"]
    reference_code = order_data["reference_code"]

    assert order_data["order_status"] == "awaiting_payment"
    assert order_data["payment_method_intent"] == "pay_at_counter"
    assert reference_code.startswith("REF-")
    assert order_data["pickup_code"] is None  # No pickup code before payment!

    # 2. Login as Cashier
    login_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "test_cashier_counter", "password": "CashierPassword123!"},
    )
    assert login_res.status_code == 200, login_res.text

    # 3. Cashier looks up the order by reference code
    lookup_res = client.get(f"/api/v1/orders/counter-lookup?q={reference_code}")
    assert lookup_res.status_code == 200, lookup_res.text
    results = lookup_res.json()
    assert len(results) == 1
    assert results[0]["order_id"] == order_id
    assert results[0]["customer_name"] == "Maria Santos"

    total_due = Decimal(str(results[0]["total_amount"]))

    # 4. Cashier attempts payment with insufficient cash tendered (should fail)
    under_res = client.post(
        f"/api/v1/orders/{order_id}/pay-at-counter",
        json={"payment_method": "cash", "amount_tendered": float(total_due - Decimal("1.00"))},
    )
    assert under_res.status_code == 400

    # 5. Cashier completes payment with $20.00 cash
    pay_res = client.post(
        f"/api/v1/orders/{order_id}/pay-at-counter",
        json={"payment_method": "cash", "amount_tendered": 20.00},
    )
    assert pay_res.status_code == 200, pay_res.text
    paid_data = pay_res.json()

    assert paid_data["order_status"] == "confirmed"
    assert paid_data["pickup_code"] is not None
    assert paid_data["pickup_code"].startswith("BF-")
    assert Decimal(str(paid_data["amount_tendered"])) == Decimal("20.00")
    assert Decimal(str(paid_data["change_due"])) == Decimal("20.00") - total_due

    # 6. Verify immutable PDF receipt was generated on disk
    receipt_pdf_url = paid_data["receipt_pdf_url"]
    assert receipt_pdf_url is not None
    assert receipt_pdf_url.startswith("/uploads/receipts/receipt_")

    # Verify physical file existence
    base_dir = os.path.dirname(os.path.dirname(__file__))
    clean_rel = receipt_pdf_url.lstrip("/")
    abs_pdf_path = os.path.join(base_dir, clean_rel)
    assert os.path.exists(abs_pdf_path), f"Expected PDF file at {abs_pdf_path}"


def test_expired_counter_order_rejection(client: TestClient, db: Session):
    menu_item_id, cashier_user = setup_counter_test_data(db)

    # 1. Create Counter Order
    order_payload = {
        "first_name": "Late",
        "last_name": "Customer",
        "email": f"late.customer_{os.urandom(4).hex()}@example.com",
        "order_type": "takeout",
        "payment_method_intent": "pay_at_counter",
        "items": [{"menu_item_id": menu_item_id, "quantity": 1, "addons": []}],
    }
    create_res = client.post("/api/v1/customer/orders", json=order_payload)
    assert create_res.status_code == 201
    order_id = create_res.json()["order_id"]

    # 2. Manually set expiry to the past
    order = db.get(Order, order_id)
    order.expires_at = utc_now() - timedelta(minutes=5)
    db.commit()

    # 3. Login as Cashier
    login_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "test_cashier_counter", "password": "CashierPassword123!"},
    )
    assert login_res.status_code == 200

    # 4. Attempt to pay expired order (should fail and mark expired)
    pay_res = client.post(
        f"/api/v1/orders/{order_id}/pay-at-counter",
        json={"payment_method": "cash", "amount_tendered": 50.00},
    )
    assert pay_res.status_code == 400
    assert "expired" in pay_res.json()["detail"].lower()

    db.refresh(order)
    assert order.order_status == OrderStatus.EXPIRED
    assert order.customer.no_show_count >= 1


def test_counter_order_editing_before_payment_and_1_day_expiry(client: TestClient, db: Session):
    menu_item_id, cashier_user = setup_counter_test_data(db)

    # 1. Customer creates online order with pay_at_counter
    unique_email = f"edit_test_{os.urandom(4).hex()}@coffeeshop.ph"
    order_payload = {
        "first_name": "Juan",
        "last_name": "Dela Cruz",
        "email": unique_email,
        "order_type": "takeout",
        "payment_method_intent": "pay_at_counter",
        "items": [{"menu_item_id": menu_item_id, "quantity": 1, "addons": []}],
    }
    create_res = client.post("/api/v1/customer/orders", json=order_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    order_id = created_data["order_id"]
    ref_code = created_data["reference_code"]

    # 2. Verify 1-day (24-hour) expiration
    order = db.get(Order, order_id)
    assert order.order_status == OrderStatus.AWAITING_PAYMENT
    assert order.expires_at is not None
    time_diff = (order.expires_at - order.order_date).total_seconds()
    assert 86000 <= time_diff <= 86500  # Approximately 24 hours (86,400s)

    # 3. Cashier logs in
    login_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "test_cashier_counter", "password": "CashierPassword123!"},
    )
    assert login_res.status_code == 200

    # 4. Cashier looks up order by reference code
    lookup_res = client.get(f"/api/v1/orders/counter-lookup?q={ref_code}")
    assert lookup_res.status_code == 200
    assert len(lookup_res.json()) >= 1
    assert lookup_res.json()[0]["order_id"] == order_id

    # 5. Cashier modifies order (increases quantity from 1 to 2) and pays with cash
    updated_items = [{"menu_item_id": menu_item_id, "quantity": 2, "addons": []}]
    pay_res = client.post(
        f"/api/v1/orders/{order_id}/pay-at-counter",
        json={
            "payment_method": "cash",
            "amount_tendered": 20.00,
            "items": updated_items,
        },
    )
    assert pay_res.status_code == 200
    paid_data = pay_res.json()

    # 6. Verify updated totals, pickup code, and status
    assert paid_data["order_status"].lower() == "confirmed"
    assert paid_data["pickup_code"] is not None
    # 2 * 4.00 = 8.00 subtotal + 8% tax = 8.64
    assert Decimal(str(paid_data["total_amount"])) == Decimal("8.64")
    assert len(paid_data["items"]) == 1
    assert paid_data["items"][0]["quantity"] == 2

    # 7. Verify inventory deducted for 2 items
    db.refresh(order)
    inv_item = db.query(InventoryItem).filter(InventoryItem.item_name == "Counter Test Espresso Beans").first()
    # 2 * 0.015 = 0.030 kg deducted
    assert inv_item.quantity_on_hand == Decimal("50.000") - Decimal("0.030")

