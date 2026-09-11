import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import app
from app.modules.orders import service as orders_service
from app.modules.orders.models import (
    Order,
    OrderEvent,
    OrderStatus,
)
from app.modules.orders.schemas import (
    OrderItemCreate,
    POSOrderCreateRequest,
)
from app.modules.payments.models import PaymentMethod
from tests.test_orders_and_fulfillment import (
    create_or_get_staff,
    setup_catalog_and_stock,
)

client = TestClient(app)


def test_order_event_audit_trail_captures_all_fields():
    session = SessionLocal()
    try:
        item, size, addon, _, _ = setup_catalog_and_stock(session)
        manager, cookies = create_or_get_staff(session, "Manager")
        barista, _ = create_or_get_staff(session, "Barista")

        # 1. Create a POS order (initial state: CONFIRMED)
        payload = POSOrderCreateRequest(
            customer_name="Event Test Customer",
            items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=1)],
            payment_method=PaymentMethod.CASH,
            amount_tendered=Decimal("10.00"),
        )
        order = orders_service.create_pos_order(session, manager, payload)
        order_id = order.order_id

        # Verify initial creation event
        events = list(
            session.scalars(
                select(OrderEvent)
                .where(OrderEvent.order_id == order_id)
                .order_by(OrderEvent.created_at.asc())
            ).all()
        )
        assert len(events) >= 1
        first_event = events[0]
        assert first_event.previous_status is None
        assert first_event.new_status == OrderStatus.CONFIRMED
        assert first_event.user_id == manager.user_id
        assert first_event.created_at is not None

        # 2. Advance to PREPARING by barista
        orders_service.update_order_status(session, order_id, OrderStatus.PREPARING, barista)

        # 3. Advance to READY by barista with optional metadata
        orders_service.update_order_status(
            session,
            order_id,
            OrderStatus.READY,
            barista,
            metadata={"station": "espresso_bar_1", "notes": "extra hot"},
        )

        # 4. Advance to COMPLETED by manager
        orders_service.update_order_status(session, order_id, OrderStatus.COMPLETED, manager)

        # Fetch all captured events
        session.expire_all()
        all_events = list(
            session.scalars(
                select(OrderEvent)
                .where(OrderEvent.order_id == order_id)
                .order_by(OrderEvent.created_at.asc())
            ).all()
        )

        assert len(all_events) == 4
        # Event 1: Creation -> CONFIRMED
        assert all_events[0].new_status == OrderStatus.CONFIRMED
        # Event 2: CONFIRMED -> PREPARING (Barista)
        assert all_events[1].previous_status == OrderStatus.CONFIRMED
        assert all_events[1].new_status == OrderStatus.PREPARING
        assert all_events[1].user_id == barista.user_id
        assert all_events[1].staff_actor.user_id == barista.user_id
        assert all_events[1].created_at is not None
        # Event 3: PREPARING -> READY (Barista with optional metadata)
        assert all_events[2].previous_status == OrderStatus.PREPARING
        assert all_events[2].new_status == OrderStatus.READY
        assert all_events[2].user_id == barista.user_id
        assert "espresso_bar_1" in all_events[2].metadata_json
        # Event 4: READY -> COMPLETED (Manager)
        assert all_events[3].previous_status == OrderStatus.READY
        assert all_events[3].new_status == OrderStatus.COMPLETED
        assert all_events[3].user_id == manager.user_id
        assert all_events[3].staff_actor.user_id == manager.user_id
    finally:
        session.close()


def test_fulfilment_queue_and_pickup_board_endpoints():
    session = SessionLocal()
    try:
        item, _, _, _, _ = setup_catalog_and_stock(session)
        barista, cookies = create_or_get_staff(session, "Barista")
        manager, _ = create_or_get_staff(session, "Manager")

        # Create active orders
        payload = POSOrderCreateRequest(
            customer_name="Queue Customer",
            items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=2)],
            payment_method=PaymentMethod.CASH,
            amount_tendered=Decimal("20.00"),
        )
        order = orders_service.create_pos_order(session, manager, payload)

        # 1. Staff Fulfilment Queue Endpoint
        queue_resp = client.get("/api/v1/fulfilment/queue", cookies=cookies)
        assert queue_resp.status_code == 200
        queue_data = queue_resp.json()
        assert "tickets" in queue_data
        assert queue_data["active_count"] >= 1
        ticket = next((t for t in queue_data["tickets"] if t["order_id"] == order.order_id), None)
        assert ticket is not None
        assert ticket["estimated_prep_minutes"] > 0
        assert ticket["priority_rank"] >= 1
        assert len(ticket["items"]) >= 1

        # Advance to READY
        orders_service.update_order_status(session, order.order_id, OrderStatus.PREPARING, barista)
        orders_service.update_order_status(session, order.order_id, OrderStatus.READY, barista)

        # 2. Public Pickup Board Endpoint (no auth needed)
        pickup_resp = client.get("/api/v1/customer/pickup-board")
        assert pickup_resp.status_code == 200
        board_data = pickup_resp.json()
        assert "ready" in board_data
        assert "preparing" in board_data
        ready_ticket = next((t for t in board_data["ready"] if t["pickup_code"] == order.pickup_code), None)
        assert ready_ticket is not None
        assert ready_ticket["order_status"] == "ready"
        assert ready_ticket["display_status"] == "Ready for Pickup"
        # Confirm no customer PII is leaked in public pickup board
        assert "customer_name" not in ready_ticket
        assert "items" not in ready_ticket
    finally:
        session.close()


def test_validate_and_prepare_reorder():
    session = SessionLocal()
    try:
        item, _, _, _, _ = setup_catalog_and_stock(session)
        customer_email = f"reorder_{uuid.uuid4().hex[:6]}@example.com"

        # Create online order
        from app.modules.orders.schemas import CustomerOrderCreateRequest
        from app.modules.orders.models import OrderType

        order_req = CustomerOrderCreateRequest(
            first_name="Reorder",
            last_name="Tester",
            email=customer_email,
            order_type=OrderType.TAKEOUT,
            items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=1)],
        )
        order = orders_service.create_customer_order(session, order_req, client_ip="127.0.0.1")

        # 1. Reorder validation succeeds with matching customer email
        resp = client.post(
            f"/api/v1/customer/orders/{order.order_id}/reorder",
            json={"email": customer_email},
        )
        assert resp.status_code == 200
        reorder_data = resp.json()
        assert reorder_data["can_reorder"] is True
        assert len(reorder_data["items"]) == 1
        assert reorder_data["items"][0]["menu_item_id"] == item.menu_item_id
        assert Decimal(str(reorder_data["total_amount"])) > 0

        # 2. Reorder validation with mismatched email returns 404
        wrong_resp = client.post(
            f"/api/v1/customer/orders/{order.order_id}/reorder",
            json={"email": "intruder@example.com"},
        )
        assert wrong_resp.status_code == 404
    finally:
        session.close()


def test_reorder_stock_depletion_and_lazy_expiry_event():
    session = SessionLocal()
    try:
        item, _, _, inv_beans, _ = setup_catalog_and_stock(session)
        customer_email = f"stocktest_{uuid.uuid4().hex[:6]}@example.com"

        from app.modules.orders.schemas import CustomerOrderCreateRequest
        from app.modules.orders.models import OrderType
        from datetime import datetime, timedelta, timezone

        order_req = CustomerOrderCreateRequest(
            first_name="Stock",
            last_name="Deplete",
            email=customer_email,
            order_type=OrderType.TAKEOUT,
            items=[OrderItemCreate(menu_item_id=item.menu_item_id, quantity=1)],
        )
        order = orders_service.create_customer_order(session, order_req, client_ip="127.0.0.1")

        # 1. Deplete stock so reorder fails gracefully
        inv_beans.quantity_on_hand = Decimal("0.000")
        session.commit()

        reorder_resp = client.post(
            f"/api/v1/customer/orders/{order.order_id}/reorder",
            json={"email": customer_email},
        )
        assert reorder_resp.status_code == 200
        reorder_data = reorder_resp.json()
        assert reorder_data["can_reorder"] is False
        assert len(reorder_data["unavailable_reasons"]) >= 1

        # 2. Test lazy expiry OrderEvent recording
        order.expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        session.commit()

        # Track order past expiry
        tracked_order = orders_service.get_order_for_tracking(session, order.order_id, customer_email)
        assert tracked_order.order_status == OrderStatus.EXPIRED

        # Verify OrderEvent was emitted
        events = list(
            session.scalars(
                select(OrderEvent)
                .where(OrderEvent.order_id == order.order_id)
                .order_by(OrderEvent.created_at.desc())
            ).all()
        )
        latest_event = events[0]
        assert latest_event.new_status == OrderStatus.EXPIRED
        assert latest_event.previous_status == OrderStatus.AWAITING_PAYMENT
    finally:
        session.close()

