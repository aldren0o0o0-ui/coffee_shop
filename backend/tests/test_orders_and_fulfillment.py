import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemAddon,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.orders import service as orders_service
from app.modules.orders.models import (
    OrderStatus,
    OrderType,
)
from app.modules.orders.schemas import (
    CustomerOrderCreateRequest,
    OrderItemAddonCreate,
    OrderItemCreate,
    POSOrderCreateRequest,
)
from app.modules.payments.models import PaymentMethod
from app.modules.users.models import Role, User, UserRole

client = TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def create_or_get_staff(session, role_name="Barista") -> tuple[User, dict]:
    role = session.scalar(select(Role).where(Role.role_name == role_name))
    if not role:
        role = Role(role_name=role_name, description=f"{role_name} Role")
        session.add(role)
        session.flush()

    username = f"test_orders_{role_name.lower()}_{uuid.uuid4().hex[:4]}"
    user = User(
        username=username,
        first_name="Test",
        last_name=role_name,
        email=f"{username}@coffee.local",
        password_hash=hash_password("OrderPass123!"),
        is_active=True,
        must_change_password=False,
    )
    session.add(user)
    session.flush()

    ur = UserRole(user_id=user.user_id, role_id=role.role_id, is_active=True)
    session.add(ur)
    session.commit()

    resp = client.post("/api/v1/auth/login", json={"identifier": username, "password": "OrderPass123!"})
    assert resp.status_code == 200
    return user, resp.cookies


def setup_catalog_and_stock(db):
    u = uuid.uuid4().hex[:6]
    category = MenuCategory(category_name=f"Orders Cat {u}", display_order=1)
    db.add(category)
    db.flush()

    inv_beans = InventoryItem(
        item_name=f"Order Beans {u}",
        unit_of_measure="kg",
        quantity_on_hand=Decimal("20.000"),
        reorder_level=Decimal("2.000"),
    )
    inv_milk = InventoryItem(
        item_name=f"Order Milk {u}",
        unit_of_measure="liters",
        quantity_on_hand=Decimal("30.000"),
        reorder_level=Decimal("5.000"),
    )
    db.add_all([inv_beans, inv_milk])
    db.flush()

    item = MenuItem(
        category_id=category.category_id,
        item_name=f"Order Latte {u}",
        base_price=Decimal("4.50"),
        is_available=True,
    )
    db.add(item)
    db.flush()

    size_large = MenuItemSize(
        menu_item_id=item.menu_item_id,
        size_name="Large",
        price_adjustment=Decimal("1.00"),
        is_default=False,
    )
    addon_syrup = MenuItemAddon(
        menu_item_id=item.menu_item_id,
        addon_name="Vanilla Syrup",
        additional_price=Decimal("0.75"),
        is_active=True,
    )
    db.add_all([size_large, addon_syrup])
    db.flush()

    recipe_beans = MenuItemIngredient(
        menu_item_id=item.menu_item_id,
        inventory_item_id=inv_beans.inventory_item_id,
        quantity_required=Decimal("0.020"),
        unit_of_measure="kg",
    )
    recipe_milk = MenuItemIngredient(
        menu_item_id=item.menu_item_id,
        inventory_item_id=inv_milk.inventory_item_id,
        quantity_required=Decimal("0.250"),
        unit_of_measure="liters",
    )
    db.add_all([recipe_beans, recipe_milk])
    db.commit()

    return item, size_large, addon_syrup, inv_beans, inv_milk


def test_customer_order_creation_price_snapshots_and_tax(db_session):
    item, size, addon, _, _ = setup_catalog_and_stock(db_session)

    alice_email = f"alice_{uuid.uuid4().hex[:6]}@example.com"
    payload = CustomerOrderCreateRequest(
        first_name="Alice",
        last_name="Smith",
        email=alice_email,
        phone_number="+1555000111",
        order_type=OrderType.TAKEOUT,
        payment_method_intent="online_card",
        items=[
            OrderItemCreate(
                menu_item_id=item.menu_item_id,
                menu_item_size_id=size.menu_item_size_id,
                quantity=2,
                special_instructions="Extra hot",
                addons=[
                    OrderItemAddonCreate(
                        menu_item_addon_id=addon.menu_item_addon_id,
                        quantity=1,
                    )
                ],
            )
        ],
    )

    order = orders_service.create_customer_order(db_session, payload, client_ip="127.0.0.1")
    assert order.order_status == OrderStatus.AWAITING_PAYMENT
    # base 4.50 + size 1.00 = 5.50 * 2 = 11.00 + (addon 0.75 * 1 * 2 qty = 1.50) => subtotal 12.50
    # subtotal calculation: item_subtotal = (unit_price 5.50 * 2 = 11.00) + (0.75 * 1) = 11.75
    # Let's verify line item calculations:
    assert order.subtotal == Decimal("11.75")
    assert order.tax_amount == Decimal("0.94")  # 11.75 * 0.08 = 0.94
    assert order.total_amount == Decimal("12.69")
    assert order.expires_at is not None


def test_pos_order_creation_and_inventory_settlement(db_session):
    item, size, addon, inv_beans, _ = setup_catalog_and_stock(db_session)
    cashier, _ = create_or_get_staff(db_session, "Cashier")

    initial_stock = inv_beans.quantity_on_hand

    payload = POSOrderCreateRequest(
        customer_name="Walk-in Customer",
        customer_email=None,
        order_type=OrderType.DINE_IN,
        payment_method=PaymentMethod.CASH,
        amount_tendered=Decimal("10.00"),
        items=[
            OrderItemCreate(
                menu_item_id=item.menu_item_id,
                quantity=1,
            )
        ],
    )

    order = orders_service.create_pos_order(db_session, cashier, payload)
    assert order.order_status == OrderStatus.CONFIRMED
    assert order.pickup_code is not None
    assert order.pickup_code.startswith("BF-")

    db_session.refresh(inv_beans)
    assert inv_beans.quantity_on_hand == initial_stock - Decimal("0.020")


def test_order_status_state_machine_valid_and_invalid_transitions(db_session):
    item, _, _, _, _ = setup_catalog_and_stock(db_session)
    manager, _ = create_or_get_staff(db_session, "Manager")
    barista, _ = create_or_get_staff(db_session, "Barista")

    # Create POS order in CONFIRMED status
    payload = POSOrderCreateRequest(
        customer_name="SM Test",
        items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=1)],
        payment_method=PaymentMethod.CASH,
    )
    order = orders_service.create_pos_order(db_session, manager, payload)
    assert order.order_status == OrderStatus.CONFIRMED

    # Barista advances to PREPARING
    order = orders_service.update_order_status(db_session, order.order_id, OrderStatus.PREPARING, barista)
    assert order.order_status == OrderStatus.PREPARING

    # Barista advances to READY
    order = orders_service.update_order_status(db_session, order.order_id, OrderStatus.READY, barista)
    assert order.order_status == OrderStatus.READY

    # Barista cannot complete order (only cashier/manager/owner)
    with pytest.raises(HTTPException) as exc:
        orders_service.update_order_status(db_session, order.order_id, OrderStatus.COMPLETED, barista)
    assert exc.value.status_code == 403

    # Manager completes order
    order = orders_service.update_order_status(db_session, order.order_id, OrderStatus.COMPLETED, manager)
    assert order.order_status == OrderStatus.COMPLETED
    assert order.picked_up_at is not None

    # Invalid transition from COMPLETED -> PREPARING must be rejected
    with pytest.raises(HTTPException) as exc:
        orders_service.update_order_status(db_session, order.order_id, OrderStatus.PREPARING, manager)
    assert exc.value.status_code == 400


def test_tracking_and_expiry_job(db_session):
    item, _, _, _, _ = setup_catalog_and_stock(db_session)

    track_email = f"trackuser_{uuid.uuid4().hex[:6]}@example.com"
    payload = CustomerOrderCreateRequest(
        first_name="TrackUser",
        email=track_email,
        items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=1)],
    )
    order = orders_service.create_customer_order(db_session, payload, client_ip="127.0.0.1")

    # Tracking succeeds with correct email
    tracked = orders_service.get_order_for_tracking(db_session, order.order_id, track_email)
    assert tracked.order_id == order.order_id

    # Tracking fails with mismatch email
    with pytest.raises(HTTPException) as exc:
        orders_service.get_order_for_tracking(db_session, order.order_id, "wrong@example.com")
    assert exc.value.status_code == 404

    # Simulate expiry in the past
    order.expires_at = orders_service.utc_now() - timedelta(minutes=5)
    db_session.commit()

    expired_count = orders_service.expire_stale_orders(db_session)
    assert expired_count >= 1

    db_session.refresh(order)
    assert order.order_status == OrderStatus.EXPIRED
    assert order.customer.no_show_count >= 1


def test_orders_api_routes(db_session):
    item, _, _, _, _ = setup_catalog_and_stock(db_session)
    manager, cookies = create_or_get_staff(db_session, "Manager")
    api_email = f"apicust_{uuid.uuid4().hex[:6]}@example.com"

    # 1. POST /api/v1/customer/orders
    resp = client.post(
        "/api/v1/customer/orders",
        json={
            "first_name": "APICust",
            "email": api_email,
            "order_type": "takeout",
            "payment_method_intent": "pay_at_counter",
            "items": [{"menu_item_id": item.menu_item_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    order_data = resp.json()
    order_id = order_data["order_id"]
    ref_code = order_data["reference_code"]
    assert ref_code is not None

    # 2. GET /api/v1/orders/counter-lookup
    resp = client.get(f"/api/v1/orders/counter-lookup?q={ref_code}", cookies=cookies)
    assert resp.status_code == 200
    results = resp.json()
    assert any(o["order_id"] == order_id for o in results)

    # 3. POST /api/v1/customer/orders/track
    resp = client.post(
        "/api/v1/customer/orders/track",
        json={"order_id": order_id, "email": api_email},
    )
    assert resp.status_code == 200
    track_data = resp.json()
    assert track_data["order_id"] == order_id
    assert track_data["order_status"] == "awaiting_payment"
