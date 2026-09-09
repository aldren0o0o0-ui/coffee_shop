import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.inventory.service import (
    adjust_inventory_stock,
    create_inventory_item,
    list_inventory_transactions,
)
from app.modules.inventory.schemas import InventoryItemCreate
from app.modules.analytics.service import generate_store_reports
from app.modules.users.models import Role, User, UserRole
from app.core.security import hash_password
from app.core.rate_limit import limiter

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_limiter():
    limiter.clear_all()


def get_or_create_user(db, username, email, role_name, password="Password123!"):
    role = db.query(Role).filter(Role.role_name == role_name).first()
    if not role:
        role = Role(role_name=role_name, description=f"{role_name} role", is_active=True)
        db.add(role)
        db.flush()

    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            first_name=username.capitalize(),
            last_name="Tester",
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.user_id, role_id=role.role_id, is_active=True))
        db.commit()
    return user


def test_create_and_adjust_inventory_item():
    db = SessionLocal()
    try:
        user = get_or_create_user(db, "inv_tester", "inv_tester@coffeeshop.test", "Inventory Staff")
        
        payload = InventoryItemCreate(
            item_name=f"Organic Oat Milk {uuid.uuid4().hex[:6]}",
            unit_of_measure="cartons",
            quantity_on_hand=Decimal("20.000"),
            reorder_level=Decimal("5.000"),
            unit_cost=Decimal("150.00"),
            is_active=True,
        )
        
        item = create_inventory_item(db, payload, user.user_id)
        assert item.inventory_item_id is not None
        assert item.quantity_on_hand == Decimal("20.000")

        # Adjust stock positively (Restock)
        updated_item, tx = adjust_inventory_stock(
            database=db,
            item_id=item.inventory_item_id,
            quantity_change=Decimal("10.000"),
            transaction_type=InventoryTransactionType.ADJUSTMENT,
            created_by_user_id=user.user_id,
            notes="Restock delivery arrived",
        )
        assert updated_item.quantity_on_hand == Decimal("30.000")
        assert tx.quantity_change == Decimal("10.000")

        # Adjust stock negatively (Waste)
        updated_item2, tx2 = adjust_inventory_stock(
            database=db,
            item_id=item.inventory_item_id,
            quantity_change=Decimal("-5.000"),
            transaction_type=InventoryTransactionType.WASTE,
            created_by_user_id=user.user_id,
            notes="Spoiled cartons discarded",
        )
        assert updated_item2.quantity_on_hand == Decimal("25.000")
        assert tx2.transaction_type == InventoryTransactionType.WASTE

        # Verify transaction logs
        tx_logs = list_inventory_transactions(db, item_id=item.inventory_item_id)
        assert len(tx_logs) >= 2
    finally:
        db.close()


def test_inventory_stock_cannot_go_negative():
    db = SessionLocal()
    try:
        user = get_or_create_user(db, "inv_tester2", "inv_tester2@coffeeshop.test", "Inventory Staff")
        item = create_inventory_item(
            db,
            InventoryItemCreate(
                item_name=f"Limited Syrup {uuid.uuid4().hex[:6]}",
                unit_of_measure="bottles",
                quantity_on_hand=Decimal("2.000"),
                reorder_level=Decimal("1.000"),
                unit_cost=Decimal("250.00"),
            ),
            user.user_id,
        )

        with pytest.raises(ValueError, match="Adjustment would result in negative stock"):
            adjust_inventory_stock(
                database=db,
                item_id=item.inventory_item_id,
                quantity_change=Decimal("-5.000"),
                transaction_type=InventoryTransactionType.WASTE,
                created_by_user_id=user.user_id,
            )
    finally:
        db.close()


def test_generate_store_reports_aggregation():
    db = SessionLocal()
    try:
        reports_today = generate_store_reports(db, period="today")
        assert reports_today.period == "today"
        assert reports_today.total_revenue >= Decimal("0.00")
        assert reports_today.average_order_value >= Decimal("0.00")
        assert isinstance(reports_today.top_selling_items, list)
        assert isinstance(reports_today.sales_by_channel, list)
        assert isinstance(reports_today.sales_by_payment_method, list)
        assert isinstance(reports_today.timeline, list)

        reports_week = generate_store_reports(db, period="this_week")
        assert reports_week.period == "this_week"
        assert len(reports_week.timeline) == 7

        reports_month = generate_store_reports(db, period="this_month")
        assert reports_month.period == "this_month"
    finally:
        db.close()


def test_reports_endpoint_permissions():
    db = SessionLocal()
    try:
        get_or_create_user(db, "owner_test", "owner_test@coffeeshop.test", "Owner")
        get_or_create_user(db, "barista_test", "barista_test@coffeeshop.test", "Barista")
    finally:
        db.close()

    # Login as barista -> should be forbidden (403)
    login_barista = client.post(
        "/api/v1/auth/login",
        json={"identifier": "barista_test", "password": "Password123!"},
    )
    assert login_barista.status_code == 200
    res_forbidden = client.get("/api/v1/dashboard/reports")
    assert res_forbidden.status_code == 403

    # Login as owner -> should be allowed (200)
    login_owner = client.post(
        "/api/v1/auth/login",
        json={"identifier": "owner_test", "password": "Password123!"},
    )
    assert login_owner.status_code == 200
    res_ok = client.get("/api/v1/dashboard/reports?period=today")
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert "total_revenue" in data
    assert "top_selling_items" in data
    assert "sales_by_channel" in data
