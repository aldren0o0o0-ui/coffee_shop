import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.modules.customers.models import Customer
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory, MenuItem, MenuItemSize, MenuItemAddon, MenuItemIngredient
from app.modules.orders.models import Order, OrderStatus
from app.modules.orders.service import expire_stale_orders
from app.modules.payments.models import Payment, PaymentMethod, PaymentStatus
from app.modules.users.models import Role, User, UserRole
from app.core.rate_limit import limiter
from app.core.security import hash_password

client = TestClient(app)


def setup_test_data():
    limiter.clear_all()
    db = SessionLocal()
    # 1. Create or get test menu item & inventory
    inv_item = db.query(InventoryItem).filter(InventoryItem.item_name == "Test Espresso Beans").first()
    if not inv_item:
        inv_item = InventoryItem(
            item_name="Test Espresso Beans",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("50.000"),
            reorder_level=Decimal("5.000"),
            unit_cost=Decimal("15.00"),
            is_active=True,
        )
        db.add(inv_item)
        db.flush()

    cat = db.query(MenuCategory).filter(MenuCategory.category_name == "Test Coffee").first()
    if not cat:
        cat = MenuCategory(
            category_name="Test Coffee",
            description="Test category",
            display_order=1,
            is_active=True,
        )
        db.add(cat)
        db.flush()

    menu_item = db.query(MenuItem).filter(MenuItem.item_name == "Test Americano").first()
    if not menu_item:
        menu_item = MenuItem(
            category_id=cat.category_id,
            item_name="Test Americano",
            description="Fresh espresso and water",
            base_price=Decimal("4.50"),
            is_available=True,
            is_deleted=False,
        )
        db.add(menu_item)
        db.flush()

        size_reg = MenuItemSize(
            menu_item_id=menu_item.menu_item_id,
            size_name="Regular",
            price_adjustment=Decimal("0.00"),
            is_default=True,
        )
        size_lrg = MenuItemSize(
            menu_item_id=menu_item.menu_item_id,
            size_name="Large",
            price_adjustment=Decimal("1.00"),
            is_default=False,
        )
        db.add(size_reg)
        db.add(size_lrg)
        db.flush()

        addon = MenuItemAddon(
            menu_item_id=menu_item.menu_item_id,
            addon_name="Extra Shot",
            additional_price=Decimal("0.80"),
            is_active=True,
        )
        db.add(addon)
        db.flush()

        ing = MenuItemIngredient(
            menu_item_id=menu_item.menu_item_id,
            inventory_item_id=inv_item.inventory_item_id,
            quantity_required=Decimal("0.020"),
            unit_of_measure="kg",
        )
        db.add(ing)
        db.commit()
    else:
        menu_item.is_available = True
        menu_item.is_deleted = False
        db.commit()

    menu_item_id = menu_item.menu_item_id
    size_id = menu_item.sizes[0].menu_item_size_id
    addon_id = menu_item.addons[0].menu_item_addon_id

    # Create Owner, Barista, and Inventory Staff users
    owner_role = db.query(Role).filter(Role.role_name == "Owner").first()
    if not owner_role:
        owner_role = Role(role_name="Owner", description="Owner", is_active=True)
        db.add(owner_role)
        db.flush()

    barista_role = db.query(Role).filter(Role.role_name == "Barista").first()
    if not barista_role:
        barista_role = Role(role_name="Barista", description="Barista", is_active=True)
        db.add(barista_role)
        db.flush()

    inventory_role = db.query(Role).filter(Role.role_name == "Inventory Staff").first()
    if not inventory_role:
        inventory_role = Role(role_name="Inventory Staff", description="Inventory Staff", is_active=True)
        db.add(inventory_role)
        db.flush()

    owner_user = db.query(User).filter(User.username == "test_owner").first()
    if not owner_user:
        owner_user = User(
            username="test_owner",
            email="owner_test@brewflow.local",
            password_hash=hash_password("OwnerPassword123!"),
            first_name="Admin",
            last_name="Owner",
            is_active=True,
        )
        db.add(owner_user)
        db.flush()
        db.add(UserRole(user_id=owner_user.user_id, role_id=owner_role.role_id, is_active=True))

    barista_user = db.query(User).filter(User.username == "test_barista").first()
    if not barista_user:
        barista_user = User(
            username="test_barista",
            email="barista_test@brewflow.local",
            password_hash=hash_password("BaristaPassword123!"),
            first_name="Bob",
            last_name="Barista",
            is_active=True,
        )
        db.add(barista_user)
        db.flush()
        db.add(UserRole(user_id=barista_user.user_id, role_id=barista_role.role_id, is_active=True))

    inventory_user = db.query(User).filter(User.username == "test_inventory").first()
    if not inventory_user:
        inventory_user = User(
            username="test_inventory",
            email="inventory_test@brewflow.local",
            password_hash=hash_password("InventoryPassword123!"),
            first_name="Ivan",
            last_name="Inventory",
            is_active=True,
        )
        db.add(inventory_user)
        db.flush()
        db.add(UserRole(user_id=inventory_user.user_id, role_id=inventory_role.role_id, is_active=True))

    db.commit()
    db.close()
    return menu_item_id, size_id, addon_id


def test_complete_ordering_and_dashboard_flow():
    menu_item_id, size_id, addon_id = setup_test_data()

    # Step 1: Customer Creates Online Order (Layer 1 - Awaiting Payment)
    guest_email = f"guest_{uuid.uuid4().hex[:6]}@example.com"
    order_payload = {
        "first_name": "Alice",
        "last_name": "Smith",
        "email": guest_email,
        "phone_number": "+1234567890",
        "order_type": "takeout",
        "items": [
            {
                "menu_item_id": menu_item_id,
                "menu_item_size_id": size_id,
                "quantity": 2,
                "special_instructions": "Extra hot please",
                "addons": [
                    {
                        "menu_item_addon_id": addon_id,
                        "quantity": 1,
                    }
                ],
            }
        ],
    }

    create_res = client.post("/api/v1/customer/orders", json=order_payload)
    assert create_res.status_code == 201, create_res.text
    order_data = create_res.json()
    order_id = order_data["order_id"]
    assert order_data["order_status"] == "awaiting_payment"
    assert order_data["pickup_code"] is None
    assert order_data["expires_at"] is not None

    # Step 2: Verify Unpaid Order is NOT in Barista Live Queue
    client.post("/api/v1/auth/login", json={"identifier": "test_barista", "password": "BaristaPassword123!"})
    barista_queue_res = client.get("/api/v1/dashboard/barista-queue")
    assert barista_queue_res.status_code == 200
    queue_data = barista_queue_res.json()
    unpaid_in_queue = any(ticket["order_id"] == order_id for ticket in queue_data["tickets"])
    assert not unpaid_in_queue, "Unpaid order must NOT appear in barista queue!"

    # Step 3: Secure Order Tracking Check
    bad_track = client.post("/api/v1/customer/orders/track", json={
        "order_id": order_id,
        "email": "wrong_email@example.com",
    })
    assert bad_track.status_code == 404

    good_track = client.post("/api/v1/customer/orders/track", json={
        "order_id": order_id,
        "email": guest_email,
    })
    assert good_track.status_code == 200
    assert good_track.json()["order_status"] == "awaiting_payment"

    # Step 4: Pay for Order (with ownership email check)
    bad_email_pay = client.post(f"/api/v1/customer/orders/{order_id}/pay", json={
        "email": "impostor@example.com",
        "payment_method": "card",
        "idempotency_key": str(uuid.uuid4()),
    })
    assert bad_email_pay.status_code == 404

    idempotency_key = str(uuid.uuid4())
    pay_res = client.post(f"/api/v1/customer/orders/{order_id}/pay", json={
        "email": guest_email,
        "payment_method": "card",
        "idempotency_key": idempotency_key,
    })
    assert pay_res.status_code == 200, pay_res.text
    paid_data = pay_res.json()
    assert paid_data["order_status"] == "confirmed"
    pickup_code = paid_data["pickup_code"]
    assert pickup_code is not None
    assert pickup_code.startswith("BF-")

    # Step 5: Idempotency Check
    pay_dup_res = client.post(f"/api/v1/customer/orders/{order_id}/pay", json={
        "email": guest_email,
        "payment_method": "card",
        "idempotency_key": idempotency_key,
    })
    assert pay_dup_res.status_code == 200
    assert pay_dup_res.json()["pickup_code"] == pickup_code

    # Step 6: Verified Paid Order NOW appears in Barista Queue
    barista_queue_res2 = client.get("/api/v1/dashboard/barista-queue")
    queue_data2 = barista_queue_res2.json()
    paid_in_queue = next((t for t in queue_data2["tickets"] if t["order_id"] == order_id), None)
    assert paid_in_queue is not None, "Paid confirmed order MUST appear in barista queue!"
    assert paid_in_queue["pickup_code"] == pickup_code

    # Step 7: Barista advances status to PREPARING then READY
    prep_res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "preparing"})
    assert prep_res.status_code == 200
    assert prep_res.json()["order_status"] == "preparing"

    ready_res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "ready"})
    assert ready_res.status_code == 200
    assert ready_res.json()["order_status"] == "ready"

    # Step 8: Complete Order (Cashier / Owner / Manager confirms customer pickup)
    client.post("/api/v1/auth/login", json={"identifier": "test_owner", "password": "OwnerPassword123!"})
    comp_res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "completed"})
    assert comp_res.status_code == 200, comp_res.text
    assert comp_res.json()["order_status"] == "completed"
    assert comp_res.json()["picked_up_at"] is not None

    # Step 9: Verify Owner Dashboard overview returns real aggregated revenue and orders
    owner_dash_res = client.get("/api/v1/dashboard/overview")
    assert owner_dash_res.status_code == 200
    owner_stats = owner_dash_res.json()["owner_stats"]
    assert float(owner_stats["today_revenue"]) > 0
    assert owner_stats["completed_orders_count"] >= 1

    # Step 10: Test Expiry Sweep Job
    db = SessionLocal()
    stale_order = Order(
        order_channel="online",
        order_status=OrderStatus.AWAITING_PAYMENT,
        order_type="takeout",
        subtotal=Decimal("10.00"),
        tax_amount=Decimal("0.80"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("10.80"),
        order_date=datetime.now(timezone.utc) - timedelta(minutes=20),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    db.add(stale_order)
    db.commit()
    stale_id = stale_order.order_id
    db.close()

    expired_count = expire_stale_orders(db)
    assert expired_count >= 1

    db = SessionLocal()
    refreshed_stale = db.get(Order, stale_id)
    assert refreshed_stale.order_status == OrderStatus.EXPIRED
    db.close()

    # Step 11: Paying an expired order must be rejected
    pay_expired_res = client.post(f"/api/v1/customer/orders/{stale_id}/pay", json={
        "email": "any_customer@example.com",
        "payment_method": "card",
        "idempotency_key": str(uuid.uuid4()),
    })
    assert pay_expired_res.status_code == 404 or pay_expired_res.status_code == 400

    # Step 12: Test Blocked Customer (Layer 6)
    db = SessionLocal()
    blocked_email = f"blocked_abuser_{uuid.uuid4().hex[:6]}@example.com"
    blocked_cust = Customer(
        email=blocked_email,
        first_name="Spam",
        is_blocked=True,
    )
    db.add(blocked_cust)
    db.commit()
    db.close()

    blocked_res = client.post("/api/v1/customer/orders", json={
        "first_name": "Spam",
        "email": blocked_email,
        "items": [{"menu_item_id": menu_item_id, "quantity": 1}],
    })
    assert blocked_res.status_code == 403
    assert "temporarily unavailable" in blocked_res.json()["detail"].lower()


def test_role_restrictions_and_invalid_state_transitions():
    menu_item_id, size_id, addon_id = setup_test_data()

    # Create a fresh paid order (CONFIRMED status)
    cust_email = f"state_test_{uuid.uuid4().hex[:6]}@example.com"
    create_res = client.post("/api/v1/customer/orders", json={
        "first_name": "State",
        "email": cust_email,
        "items": [{"menu_item_id": menu_item_id, "quantity": 1}],
    })
    order_id = create_res.json()["order_id"]

    pay_res = client.post(f"/api/v1/customer/orders/{order_id}/pay", json={
        "email": cust_email,
        "payment_method": "card",
        "idempotency_key": str(uuid.uuid4()),
    })
    assert pay_res.status_code == 200

    # 1. Barista advances CONFIRMED to PREPARING (allowed) then READY (allowed)
    client.post("/api/v1/auth/login", json={"identifier": "test_barista", "password": "BaristaPassword123!"})
    barista_prep = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "preparing"})
    assert barista_prep.status_code == 200

    barista_ready = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "ready"})
    assert barista_ready.status_code == 200

    # 2. Barista CANNOT transition READY to COMPLETED (Barista is PREPARING/READY only)
    barista_comp_bad = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "completed"})
    assert barista_comp_bad.status_code == 403
    assert "baristas can only update" in barista_comp_bad.json()["detail"].lower()

    # 3. Inventory Staff has no permission to update order status (ARCH-1)
    client.post("/api/v1/auth/login", json={"identifier": "test_inventory", "password": "InventoryPassword123!"})
    inv_bad = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "completed"})
    assert inv_bad.status_code == 403
    assert "do not have permission" in inv_bad.json()["detail"].lower()

    # 4. Owner completes the order (allowed)
    client.post("/api/v1/auth/login", json={"identifier": "test_owner", "password": "OwnerPassword123!"})
    owner_comp = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "completed"})
    assert owner_comp.status_code == 200

    # 5. Invalid state transition: cannot transition COMPLETED back to PREPARING even as Owner (SM-1)
    owner_illegal_jump = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "preparing"})
    assert owner_illegal_jump.status_code == 400
    assert "cannot transition" in owner_illegal_jump.json()["detail"].lower()
