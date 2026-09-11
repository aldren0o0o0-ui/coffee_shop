import concurrent.futures
import threading
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory, MenuItem, MenuItemIngredient
from app.modules.payments.models import Payment, PaymentStatus

client = TestClient(app)


def setup_concurrency_test_data(initial_stock_kg: Decimal = Decimal("10.000")):
    limiter.clear_all()
    db = SessionLocal()

    # 1. Create unique inventory item
    inv_item = InventoryItem(
        item_name=f"Concurrency Beans {uuid.uuid4().hex[:6]}",
        unit_of_measure="kg",
        quantity_on_hand=initial_stock_kg,
        reorder_level=Decimal("1.000"),
        unit_cost=Decimal("14.00"),
        is_active=True,
    )
    db.add(inv_item)
    db.flush()

    # 2. Create Category and Menu item with ingredient (0.050 kg per item)
    cat = MenuCategory(
        category_name=f"Concurrency Cat {uuid.uuid4().hex[:6]}",
        description="Concurrency test category",
        display_order=99,
        is_active=True,
    )
    db.add(cat)
    db.flush()

    menu_item = MenuItem(
        category_id=cat.category_id,
        item_name=f"Concurrency Drink {uuid.uuid4().hex[:6]}",
        description="Drink for concurrency testing",
        base_price=Decimal("6.00"),
        is_available=True,
    )
    db.add(menu_item)
    db.flush()

    ing = MenuItemIngredient(
        menu_item_id=menu_item.menu_item_id,
        inventory_item_id=inv_item.inventory_item_id,
        quantity_required=Decimal("0.050"),  # 50g
        unit_of_measure="kg",
    )
    db.add(ing)
    db.commit()

    inv_id = inv_item.inventory_item_id
    item_id = menu_item.menu_item_id
    db.close()
    return inv_id, item_id


def test_concurrent_payment_same_idempotency_key_deducts_inventory_only_once():
    inv_id, item_id = setup_concurrency_test_data(initial_stock_kg=Decimal("5.000"))

    # Create online order (quantity 2 -> 2 * 0.050 = 0.100 kg)
    guest_email = f"concurrent_guest_{uuid.uuid4().hex[:6]}@example.com"
    create_res = client.post(
        "/api/v1/customer/orders",
        json={
            "first_name": "Concurrent",
            "last_name": "Tester",
            "email": guest_email,
            "order_type": "takeout",
            "items": [{"menu_item_id": item_id, "quantity": 2, "addons": []}],
        },
    )
    assert create_res.status_code == 201, create_res.text
    order_id = create_res.json()["order_id"]

    idempotency_key = f"concurrent-idem-{uuid.uuid4().hex}"

    def send_payment():
        # Use a fresh test client in each thread to simulate real concurrent connections
        thread_client = TestClient(app)
        return thread_client.post(
            f"/api/v1/customer/orders/{order_id}/pay",
            json={
                "email": guest_email,
                "payment_method": "card",
                "idempotency_key": idempotency_key,
            },
        )

    # Spawn 4 concurrent payment attempts simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(send_payment) for _ in range(4)]
        responses = [f.result() for f in concurrent.futures.as_completed(futures)]

    # All successful responses must return confirmed status and the same pickup code
    status_codes = [r.status_code for r in responses]
    assert all(code == 200 for code in status_codes), f"Unexpected status codes: {status_codes}"

    pickup_codes = {r.json()["pickup_code"] for r in responses}
    assert len(pickup_codes) == 1, f"Expected identical pickup code across idempotent calls, got {pickup_codes}"

    # Verify inventory was deducted exactly ONCE (0.100 kg total deduction from 5.000 kg -> 4.900 kg)
    db = SessionLocal()
    inv_item = db.get(InventoryItem, inv_id)
    assert inv_item.quantity_on_hand == Decimal("4.900"), f"Expected 4.900 kg, got {inv_item.quantity_on_hand}"

    # Verify exactly 1 COMPLETED payment record exists in the DB
    payments = list(
        db.scalars(
            select(Payment).where(
                Payment.order_id == order_id,
                Payment.payment_status == PaymentStatus.COMPLETED,
            )
        ).all()
    )
    assert len(payments) == 1, f"Expected 1 completed payment, got {len(payments)}"
    db.close()


def test_concurrent_payments_competing_for_limited_inventory():
    # Only 0.050 kg stock available (enough for 1 drink only)
    inv_id, item_id = setup_concurrency_test_data(initial_stock_kg=Decimal("0.050"))

    # Create Order 1 (needs 0.050 kg)
    email1 = f"buyer1_{uuid.uuid4().hex[:6]}@example.com"
    res1 = client.post(
        "/api/v1/customer/orders",
        json={
            "first_name": "Buyer1",
            "email": email1,
            "order_type": "takeout",
            "items": [{"menu_item_id": item_id, "quantity": 1, "addons": []}],
        },
    )
    order1_id = res1.json()["order_id"]

    # Create Order 2 (needs 0.050 kg)
    email2 = f"buyer2_{uuid.uuid4().hex[:6]}@example.com"
    res2 = client.post(
        "/api/v1/customer/orders",
        json={
            "first_name": "Buyer2",
            "email": email2,
            "order_type": "takeout",
            "items": [{"menu_item_id": item_id, "quantity": 1, "addons": []}],
        },
    )
    order2_id = res2.json()["order_id"]

    barrier = threading.Barrier(2)

    def pay_order(order_id, email):
        thread_client = TestClient(app)
        barrier.wait()
        return thread_client.post(
            f"/api/v1/customer/orders/{order_id}/pay",
            json={
                "email": email,
                "payment_method": "card",
                "idempotency_key": str(uuid.uuid4()),
            },
        )

    # Concurrently pay Order 1 and Order 2
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        fut1 = executor.submit(pay_order, order1_id, email1)
        fut2 = executor.submit(pay_order, order2_id, email2)
        r1 = fut1.result()
        r2 = fut2.result()

    codes = sorted([r1.status_code, r2.status_code])
    # Exactly one must succeed (200) and one must fail with 400 (sold out)
    assert codes == [200, 400], f"Expected [200, 400], got r1=({r1.status_code}, {r1.text}), r2=({r2.status_code}, {r2.text})"

    failed_res = r1 if r1.status_code == 400 else r2
    assert "sold out" in failed_res.json()["detail"].lower()

    # Remaining inventory must be exactly 0.000 kg (never negative)
    db = SessionLocal()
    inv_item = db.get(InventoryItem, inv_id)
    assert inv_item.quantity_on_hand == Decimal("0.000"), f"Expected 0.000 kg, got {inv_item.quantity_on_hand}"
    db.close()
