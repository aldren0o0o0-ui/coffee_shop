from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.notifications import service as notifications_service
from app.modules.notifications.models import SystemAlert
from app.modules.orders.models import Order, OrderChannel, OrderStatus, OrderType
from app.modules.shifts.models import Shift, ShiftStatus
from tests.test_orders_and_fulfillment import (
    create_or_get_staff,
    setup_catalog_and_stock,
)

client = TestClient(app)


def test_system_alert_rules_evaluation_and_deduplication():
    session = SessionLocal()
    try:
        owner, owner_cookies = create_or_get_staff(session, "Owner")
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 1. Setup critical stock item
        critical_item = InventoryItem(
            item_name="Alert Test Beans",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("2.000"),
            reorder_level=Decimal("10.000"),
            unit_cost=Decimal("150.00"),
            branch_id=1,
            is_active=True,
        )
        session.add(critical_item)

        # 2. Setup closed shift with cash variance
        variance_shift = Shift(
            branch_id=1,
            opened_by=owner.user_id,
            closed_by=owner.user_id,
            status=ShiftStatus.CLOSED,
            opening_cash=Decimal("500.00"),
            expected_cash=Decimal("1500.00"),
            counted_cash=Decimal("1450.00"),
            variance=Decimal("-50.00"),
            opened_at=today_start + timedelta(hours=1),
            closed_at=today_start + timedelta(hours=8),
        )
        session.add(variance_shift)

        # 3. Setup delayed order (> 20 mins)
        delayed_order = Order(
            order_channel=OrderChannel.IN_STORE,
            order_type=OrderType.DINE_IN,
            order_status=OrderStatus.CONFIRMED,
            subtotal=Decimal("180.00"),
            total_amount=Decimal("180.00"),
            order_date=now - timedelta(minutes=25),
            branch_id=1,
        )
        session.add(delayed_order)
        session.commit()

        # 4. Trigger evaluation -> creates alerts
        count = notifications_service.evaluate_system_alerts(session)
        assert count >= 3

        alerts = list(
            session.scalars(
                select(SystemAlert).where(SystemAlert.is_resolved.is_(False))
            ).all()
        )
        alert_types = {a.alert_type for a in alerts}
        assert "stock_critical" in alert_types
        assert "cash_variance" in alert_types
        assert "queue_delay" in alert_types

        # 5. Deduplication check: running again immediately does NOT create new alerts (cooldown)
        count_second_run = notifications_service.evaluate_system_alerts(session)
        assert count_second_run == 0
    finally:
        session.close()


def test_alerts_api_list_and_resolve():
    session = SessionLocal()
    try:
        owner, owner_cookies = create_or_get_staff(session, "Owner")
        barista, barista_cookies = create_or_get_staff(session, "Barista")

        # Create a sample alert directly if needed
        alert = SystemAlert(
            branch_id=1,
            alert_type="stock_critical",
            severity="critical",
            title="Test Critical Beans",
            message="Stock level critical test",
        )
        session.add(alert)
        session.commit()

        # 1. Fetch alerts via API
        resp = client.get("/api/v1/notifications/alerts?is_resolved=false", cookies=owner_cookies)
        assert resp.status_code == 200
        alerts = resp.json()
        assert len(alerts) >= 1
        target_alert = next((a for a in alerts if a["alert_id"] == alert.alert_id), alerts[0])
        alert_id = target_alert["alert_id"]

        # 2. Barista tries to resolve -> 403 Forbidden
        bad_resolve = client.post(
            f"/api/v1/notifications/alerts/{alert_id}/resolve",
            cookies=barista_cookies,
        )
        assert bad_resolve.status_code == 403

        # 3. Owner resolves -> 200 OK
        resolve_resp = client.post(
            f"/api/v1/notifications/alerts/{alert_id}/resolve",
            cookies=owner_cookies,
        )
        assert resolve_resp.status_code == 200
        resolved_data = resolve_resp.json()
        assert resolved_data["is_resolved"] is True
        assert resolved_data["resolved_by_user_id"] == owner.user_id
    finally:
        session.close()


def test_alert_preferences_api():
    session = SessionLocal()
    try:
        owner, owner_cookies = create_or_get_staff(session, "Owner")

        # 1. Get preferences
        get_resp = client.get("/api/v1/notifications/preferences", cookies=owner_cookies)
        assert get_resp.status_code == 200
        pref = get_resp.json()
        assert "email_alerts" in pref
        assert "stock_alerts" in pref

        # 2. Update preferences
        update_resp = client.put(
            "/api/v1/notifications/preferences",
            cookies=owner_cookies,
            json={
                "email_alerts": False,
                "stock_alerts": True,
                "financial_alerts": True,
                "min_severity": "critical",
            },
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["email_alerts"] is False
        assert updated["min_severity"] == "critical"
    finally:
        session.close()


def test_owner_dashboard_stats_and_branch_filter():
    session = SessionLocal()
    try:
        owner, owner_cookies = create_or_get_staff(session, "Owner")

        # 1. Fetch dashboard overview
        resp = client.get("/api/v1/dashboard/overview", cookies=owner_cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "owner"
        assert data["owner_stats"] is not None
        stats = data["owner_stats"]

        # 2. Verify Phase 7 extensions
        assert "cash_variance_today" in stats
        assert "queue_health" in stats
        assert "active_alerts_count" in stats
        assert isinstance(stats["queue_health"], dict)
        assert "total_queued" in stats["queue_health"]
        assert "avg_wait_minutes" in stats["queue_health"]

        # 3. Fetch with branch filter
        branch_resp = client.get("/api/v1/dashboard/overview?branch_id=1", cookies=owner_cookies)
        assert branch_resp.status_code == 200
        branch_data = branch_resp.json()
        assert branch_data["owner_stats"] is not None
    finally:
        session.close()
