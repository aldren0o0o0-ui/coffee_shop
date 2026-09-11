import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.database.session import SessionLocal
from app.main import app
from app.modules.analytics.service import (
    get_barista_queue,
    get_cashier_dashboard_stats,
    get_inventory_dashboard_stats,
    get_manager_dashboard_stats,
    get_owner_dashboard_stats,
)
from app.modules.customers.models import Customer
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemAddon,
    MenuItemSize,
)
from app.modules.orders.models import (
    Order,
    OrderChannel,
    OrderItem,
    OrderItemAddon,
    OrderStatus,
    OrderType,
)
from app.modules.procurement.models import (
    PurchaseRequest,
    PurchaseRequestStatus,
)
from app.modules.users.models import Role, User, UserRole

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


def test_owner_dashboard_metrics_aggregation():
    db = SessionLocal()
    try:
        today = datetime.now(timezone.utc)

        # Create low stock item
        low_stock_item = InventoryItem(
            item_name=f"Low Stock Milk {uuid.uuid4().hex[:4]}",
            unit_of_measure="liters",
            quantity_on_hand=Decimal("3.000"),
            reorder_level=Decimal("10.000"),
            unit_cost=Decimal("2.50"),
            is_active=True,
        )
        db.add(low_stock_item)

        # Create normal stock item
        healthy_item = InventoryItem(
            item_name=f"Healthy Sugar {uuid.uuid4().hex[:4]}",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("50.000"),
            reorder_level=Decimal("10.000"),
            unit_cost=Decimal("1.20"),
            is_active=True,
        )
        db.add(healthy_item)

        # Create orders for today
        completed_order = Order(
            order_channel=OrderChannel.IN_STORE,
            order_status=OrderStatus.COMPLETED,
            order_type=OrderType.DINE_IN,
            subtotal=Decimal("20.00"),
            tax_amount=Decimal("1.60"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("21.60"),
            order_date=today,
        )
        db.add(completed_order)

        confirmed_order = Order(
            order_channel=OrderChannel.ONLINE,
            order_status=OrderStatus.CONFIRMED,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("10.00"),
            tax_amount=Decimal("0.80"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("10.80"),
            order_date=today,
        )
        db.add(confirmed_order)
        db.commit()

        stats = get_owner_dashboard_stats(db)

        assert stats.today_revenue >= Decimal("32.40")
        assert stats.today_orders_count >= 2
        assert stats.completed_orders_count >= 1
        assert stats.active_staff_count >= 1
        assert stats.low_stock_count >= 1
        assert any(item.inventory_item_id == low_stock_item.inventory_item_id for item in stats.low_stock_items)
        assert len(stats.recent_orders) <= 5
    finally:
        db.close()


def test_manager_dashboard_metrics():
    db = SessionLocal()
    try:
        user = get_or_create_user(db, "mgr_test_user", "mgr@test.com", "Manager")
        pr = PurchaseRequest(
            requested_by=user.user_id,
            request_status=PurchaseRequestStatus.SUBMITTED,
            total_amount=Decimal("150.00"),
        )
        db.add(pr)
        db.commit()

        stats = get_manager_dashboard_stats(db)
        assert stats.orders_per_hour >= 0.0
        assert stats.pending_purchases_count >= 1
        assert stats.active_team_count >= 1
        assert len(stats.shift_team) >= 1
    finally:
        db.close()


def test_cashier_dashboard_metrics():
    db = SessionLocal()
    try:
        today = datetime.now(timezone.utc)
        awaiting_order = Order(
            order_channel=OrderChannel.IN_STORE,
            order_status=OrderStatus.AWAITING_PAYMENT,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("8.00"),
            tax_amount=Decimal("0.64"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("8.64"),
            order_date=today,
        )
        db.add(awaiting_order)

        ready_order = Order(
            order_channel=OrderChannel.ONLINE,
            order_status=OrderStatus.READY,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("12.00"),
            tax_amount=Decimal("0.96"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("12.96"),
            order_date=today,
            pickup_code="BF-9999",
        )
        db.add(ready_order)
        db.commit()

        stats = get_cashier_dashboard_stats(db)
        assert stats.awaiting_payment_count >= 1
        assert stats.ready_for_pickup_count >= 1
        assert stats.my_orders_taken_count >= 1
        assert len(stats.active_orders) >= 1
    finally:
        db.close()


def test_barista_queue_metrics_and_ticket_shape():
    db = SessionLocal()
    try:
        cat = db.query(MenuCategory).first()
        if not cat:
            cat = MenuCategory(category_name="Espresso", display_order=1, is_active=True)
            db.add(cat)
            db.flush()

        item = MenuItem(
            category_id=cat.category_id,
            item_name=f"Latte {uuid.uuid4().hex[:4]}",
            base_price=Decimal("5.00"),
            is_available=True,
        )
        db.add(item)
        db.flush()

        size = MenuItemSize(
            menu_item_id=item.menu_item_id,
            size_name="Venti",
            price_adjustment=Decimal("1.50"),
            is_default=True,
        )
        db.add(size)
        db.flush()

        addon = MenuItemAddon(
            menu_item_id=item.menu_item_id,
            addon_name="Oat Milk",
            additional_price=Decimal("0.75"),
            is_active=True,
        )
        db.add(addon)
        db.flush()

        cust = Customer(
            first_name="Queue",
            last_name="Tester",
            email=f"queue_{uuid.uuid4().hex[:4]}@test.com",
        )
        db.add(cust)
        db.flush()

        order = Order(
            customer_id=cust.customer_id,
            order_channel=OrderChannel.ONLINE,
            order_status=OrderStatus.CONFIRMED,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("7.25"),
            tax_amount=Decimal("0.58"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("7.83"),
            pickup_code="BF-Q100",
            order_date=datetime.now(timezone.utc),
        )
        db.add(order)
        db.flush()

        oi = OrderItem(
            order_id=order.order_id,
            menu_item_id=item.menu_item_id,
            menu_item_size_id=size.menu_item_size_id,
            quantity=1,
            unit_price=Decimal("6.50"),
            subtotal=Decimal("6.50"),
            special_instructions="Extra foam",
        )
        db.add(oi)
        db.flush()

        oia = OrderItemAddon(
            order_item_id=oi.order_item_id,
            menu_item_addon_id=addon.menu_item_addon_id,
            unit_price=Decimal("0.75"),
        )
        db.add(oia)
        db.commit()

        queue_stats = get_barista_queue(db)
        assert queue_stats.queued_count >= 1
        ticket = next((t for t in queue_stats.tickets if t.order_id == order.order_id), None)
        assert ticket is not None
        assert ticket.pickup_code == "BF-Q100"
        assert ticket.customer_name == "Queue Tester"
        assert len(ticket.items) == 1
        assert ticket.items[0].item_name == item.item_name
        assert ticket.items[0].size_name == "Venti"
        assert "Oat Milk" in ticket.items[0].addons
        assert ticket.items[0].special_instructions == "Extra foam"
    finally:
        db.close()


def test_inventory_staff_dashboard_metrics():
    db = SessionLocal()
    try:
        user = get_or_create_user(db, "inv_staff_user", "inv@test.com", "Inventory Staff")
        item = InventoryItem(
            item_name=f"Syrup Vanilla {uuid.uuid4().hex[:4]}",
            unit_of_measure="bottles",
            quantity_on_hand=Decimal("1.000"),
            reorder_level=Decimal("5.000"),
            unit_cost=Decimal("8.00"),
            is_active=True,
        )
        db.add(item)
        db.flush()

        tx = InventoryTransaction(
            inventory_item_id=item.inventory_item_id,
            transaction_type=InventoryTransactionType.USAGE_OUT,
            quantity_change=Decimal("-1.000"),
            created_by=user.user_id,
            reference_type="manual_adjustment",
        )
        db.add(tx)
        db.commit()

        stats = get_inventory_dashboard_stats(db)
        assert stats.total_tracked_items >= 1
        assert stats.low_stock_warnings_count >= 1
        assert len(stats.recent_transactions) >= 1
        assert any(t.item_name == item.item_name for t in stats.recent_transactions)
    finally:
        db.close()


def test_revenue_excludes_failed_and_unpaid_orders():
    db = SessionLocal()
    try:
        today = datetime.now(timezone.utc)
        start_stats = get_owner_dashboard_stats(db)
        baseline_revenue = start_stats.today_revenue

        # Unpaid order (AWAITING_PAYMENT)
        unpaid = Order(
            order_channel=OrderChannel.ONLINE,
            order_status=OrderStatus.AWAITING_PAYMENT,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("300.00"),
            tax_amount=Decimal("24.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("324.00"),
            order_date=today,
        )
        db.add(unpaid)

        # Cancelled order
        cancelled = Order(
            order_channel=OrderChannel.IN_STORE,
            order_status=OrderStatus.CANCELLED,
            order_type=OrderType.DINE_IN,
            subtotal=Decimal("500.00"),
            tax_amount=Decimal("40.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("540.00"),
            order_date=today,
        )
        db.add(cancelled)

        # Paid / Confirmed order
        paid_confirmed = Order(
            order_channel=OrderChannel.IN_STORE,
            order_status=OrderStatus.CONFIRMED,
            order_type=OrderType.TAKEOUT,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("8.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("108.00"),
            order_date=today,
        )
        db.add(paid_confirmed)
        db.commit()

        updated_stats = get_owner_dashboard_stats(db)
        # Revenue should increase by only 108.00 (the confirmed paid order), NOT 324 or 540
        assert updated_stats.today_revenue == baseline_revenue + Decimal("108.00")
    finally:
        db.close()


def test_low_stock_critical_boundary_calculation():
    db = SessionLocal()
    try:
        # Item at exactly 50% of reorder_level -> is_critical = True
        item_crit = InventoryItem(
            item_name=f"Critical Matcha {uuid.uuid4().hex[:4]}",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("5.000"),
            reorder_level=Decimal("10.000"),
            unit_cost=Decimal("20.00"),
            is_active=True,
        )
        db.add(item_crit)

        # Item above 50% but <= 100% of reorder_level -> is_critical = False
        item_low = InventoryItem(
            item_name=f"Low Chai {uuid.uuid4().hex[:4]}",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("8.000"),
            reorder_level=Decimal("10.000"),
            unit_cost=Decimal("15.00"),
            is_active=True,
        )
        db.add(item_low)
        db.commit()

        stats = get_owner_dashboard_stats(db)
        found_crit = next((i for i in stats.low_stock_items if i.inventory_item_id == item_crit.inventory_item_id), None)
        found_low = next((i for i in stats.low_stock_items if i.inventory_item_id == item_low.inventory_item_id), None)

        assert found_crit is not None
        assert found_crit.is_critical is True
        assert found_low is not None
        assert found_low.is_critical is False
    finally:
        db.close()


def test_analytics_rbac_and_overview_role_resolution():
    db = SessionLocal()
    try:
        get_or_create_user(db, "analytics_owner", "a_owner@test.com", "Owner")
        get_or_create_user(db, "analytics_barista", "a_barista@test.com", "Barista")
        get_or_create_user(db, "analytics_inv", "a_inv@test.com", "Inventory Staff")

        # Unauthenticated request to /api/v1/dashboard/overview -> 401
        res_unauth = client.get("/api/v1/dashboard/overview")
        assert res_unauth.status_code == 401

        # Barista login
        client.post("/api/v1/auth/login", json={"identifier": "analytics_barista", "password": "Password123!"})
        res_barista = client.get("/api/v1/dashboard/overview")
        assert res_barista.status_code == 200
        data = res_barista.json()
        assert data["role"] == "barista"
        assert data["barista_stats"] is not None

        # Inventory Staff login
        client.post("/api/v1/auth/login", json={"identifier": "analytics_inv", "password": "Password123!"})
        res_inv = client.get("/api/v1/dashboard/overview")
        assert res_inv.status_code == 200
        assert res_inv.json()["role"] == "inventory"

        # Owner login
        client.post("/api/v1/auth/login", json={"identifier": "analytics_owner", "password": "Password123!"})
        res_owner = client.get("/api/v1/dashboard/overview")
        assert res_owner.status_code == 200
        assert res_owner.json()["role"] == "owner"
    finally:
        db.close()
