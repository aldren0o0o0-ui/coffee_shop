import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.menu.models import MenuCategory, MenuItem, MenuItemIngredient
from app.modules.users.models import Role, User, UserRole

client = TestClient(app)


def setup_pos_test_data():
    db = SessionLocal()

    # 1. Create a dedicated test inventory item
    inv_item = InventoryItem(
        item_name=f"POS Test Beans {uuid.uuid4().hex[:6]}",
        unit_of_measure="kg",
        quantity_on_hand=Decimal("10.000"),
        reorder_level=Decimal("2.000"),
        unit_cost=Decimal("12.00"),
        is_active=True,
    )
    db.add(inv_item)
    db.flush()

    # 2. Create Category and Menu item with ingredient
    cat = MenuCategory(
        category_name=f"POS Test Category {uuid.uuid4().hex[:6]}",
        description="POS test category",
        display_order=99,
        is_active=True,
    )
    db.add(cat)
    db.flush()

    menu_item = MenuItem(
        category_id=cat.category_id,
        item_name=f"POS Test Latte {uuid.uuid4().hex[:6]}",
        description="POS Latte with recipe",
        base_price=Decimal("5.00"),
        is_available=True,
    )
    db.add(menu_item)
    db.flush()

    ing = MenuItemIngredient(
        menu_item_id=menu_item.menu_item_id,
        inventory_item_id=inv_item.inventory_item_id,
        quantity_required=Decimal("0.025"),  # 25g per cup
        unit_of_measure="kg",
    )
    db.add(ing)

    # 3. Create Cashier user
    cashier_role = db.query(Role).filter(Role.role_name == "Cashier").first()
    if not cashier_role:
        cashier_role = Role(role_name="Cashier", description="Cashier", is_active=True)
        db.add(cashier_role)
        db.flush()

    cashier_username = f"pos_cashier_{uuid.uuid4().hex[:6]}"
    cashier_user = User(
        username=cashier_username,
        email=f"{cashier_username}@brewflow.local",
        password_hash=hash_password("CashierPassword123!"),
        first_name="Clara",
        last_name="Cashier",
        is_active=True,
    )
    db.add(cashier_user)
    db.flush()
    db.add(UserRole(user_id=cashier_user.user_id, role_id=cashier_role.role_id, is_active=True))

    db.commit()
    inv_id = inv_item.inventory_item_id
    item_id = menu_item.menu_item_id
    db.close()
    return cashier_username, "CashierPassword123!", inv_id, item_id


def test_pos_order_deducts_inventory_and_logs_transaction():
    username, password, inv_id, item_id = setup_pos_test_data()

    # Login as cashier
    login_res = client.post("/api/v1/auth/login", json={"identifier": username, "password": password})
    assert login_res.status_code == 200, login_res.text

    # Record initial inventory level
    db = SessionLocal()
    initial_inv = db.get(InventoryItem, inv_id)
    assert initial_inv.quantity_on_hand == Decimal("10.000")
    db.close()

    # Submit POS order for quantity 4 (4 * 0.025 = 0.100 kg needed)
    pos_payload = {
        "customer_name": "Walk-in Bob",
        "customer_email": "walkin_bob@example.com",
        "order_type": "dine_in",
        "payment_method": "cash",
        "items": [
            {
                "menu_item_id": item_id,
                "quantity": 4,
                "special_instructions": "Oat milk please",
                "addons": [],
            }
        ],
    }

    pos_res = client.post("/api/v1/orders/pos", json=pos_payload)
    assert pos_res.status_code == 201, pos_res.text
    order_data = pos_res.json()
    order_id = order_data["order_id"]
    assert order_data["order_status"] == "confirmed"

    # Verify inventory was deducted
    db = SessionLocal()
    updated_inv = db.get(InventoryItem, inv_id)
    expected_qty = Decimal("10.000") - Decimal("0.100")  # 9.900 kg
    assert updated_inv.quantity_on_hand == expected_qty, f"Expected {expected_qty}, got {updated_inv.quantity_on_hand}"

    # Verify InventoryTransaction record was created
    tx = db.scalar(
        select(InventoryTransaction)
        .where(
            InventoryTransaction.inventory_item_id == inv_id,
            InventoryTransaction.reference_id == order_id,
        )
    )
    assert tx is not None, "InventoryTransaction USAGE_OUT not found for POS order!"
    assert tx.transaction_type == InventoryTransactionType.USAGE_OUT
    assert tx.quantity_change == Decimal("-0.100")
    db.close()


def test_pos_order_fails_when_stock_is_insufficient():
    username, password, inv_id, item_id = setup_pos_test_data()

    # Set inventory on hand to very low (0.010 kg)
    db = SessionLocal()
    inv_item = db.get(InventoryItem, inv_id)
    inv_item.quantity_on_hand = Decimal("0.010")
    db.commit()
    db.close()

    # Login as cashier
    client.post("/api/v1/auth/login", json={"identifier": username, "password": password})

    # Try to order quantity 2 (requires 0.050 kg, but only 0.010 kg available)
    pos_payload = {
        "customer_name": "Walk-in Alice",
        "order_type": "takeout",
        "payment_method": "card",
        "items": [
            {
                "menu_item_id": item_id,
                "quantity": 2,
                "addons": [],
            }
        ],
    }

    pos_res = client.post("/api/v1/orders/pos", json=pos_payload)
    assert pos_res.status_code == 400, pos_res.text
    assert "out of stock" in pos_res.json()["detail"].lower()

    # Verify inventory was NOT changed
    db = SessionLocal()
    inv_item = db.get(InventoryItem, inv_id)
    assert inv_item.quantity_on_hand == Decimal("0.010")
    db.close()
