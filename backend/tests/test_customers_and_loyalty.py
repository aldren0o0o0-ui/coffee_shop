import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import app
from app.modules.customers.models import Customer, LoyaltyTransaction, LoyaltyTransactionType
from app.modules.customers import service as customers_service
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


def create_or_get_manager_auth_cookie(session) -> dict:
    manager_role = session.scalar(select(Role).where(Role.role_name == "Manager"))
    if not manager_role:
        manager_role = Role(role_name="Manager", description="Manager Role")
        session.add(manager_role)
        session.flush()

    user = session.scalar(select(User).where(User.username == "test_cust_mgr"))
    if not user:
        user = User(
            username="test_cust_mgr",
            first_name="Test",
            last_name="Manager",
            email="test_cust_mgr@coffee.local",
            password_hash=hash_password("Manager123!"),
            is_active=True,
            must_change_password=False,
        )
        session.add(user)
        session.flush()

        ur = UserRole(user_id=user.user_id, role_id=manager_role.role_id, is_active=True)
        session.add(ur)
        session.commit()

    resp = client.post("/api/v1/auth/login", json={"identifier": "test_cust_mgr", "password": "Manager123!"})
    assert resp.status_code == 200
    return resp.cookies


def test_customer_resolution_and_guest_handling(db_session):
    u = uuid.uuid4().hex[:6]
    email = f"alice_{u}@test.local"
    phone = f"555-{u[:4]}"

    # Create guest customer
    c1 = customers_service.resolve_customer(
        database=db_session,
        first_name="Alice",
        last_name="Green",
        email=email,
        phone_number=phone,
        is_guest=True,
    )
    db_session.commit()
    assert c1.customer_id is not None
    assert c1.email == email
    assert c1.phone_number == phone
    assert c1.is_guest is True
    assert c1.is_blocked is False
    assert c1.loyalty_points_balance == 0

    # Lookup by email
    found_email = customers_service.find_customer_by_email(db_session, email.upper())
    assert found_email is not None
    assert found_email.customer_id == c1.customer_id

    # Lookup by phone
    found_phone = customers_service.find_customer_by_phone(db_session, phone)
    assert found_phone is not None
    assert found_phone.customer_id == c1.customer_id

    # Re-resolving with same email updates name but returns same customer record
    c2 = customers_service.resolve_customer(
        database=db_session,
        first_name="Alice Updated",
        last_name="Green",
        email=email,
        phone_number=phone,
    )
    db_session.commit()
    assert c2.customer_id == c1.customer_id
    assert c2.first_name == "Alice Updated"


def test_customer_duplicate_phone_protection(db_session):
    u = uuid.uuid4().hex[:6]
    shared_phone = f"555-{u[:4]}"

    # Customer 1 with phone
    c1 = customers_service.resolve_customer(
        database=db_session,
        first_name="Bob",
        email=f"bob_{u}@test.local",
        phone_number=shared_phone,
    )
    db_session.commit()

    # Customer 2 with different email but trying to claim already-used phone
    c2 = customers_service.resolve_customer(
        database=db_session,
        first_name="Charlie",
        email=f"charlie_{u}@test.local",
        phone_number=shared_phone,
    )
    db_session.commit()
    assert c2.customer_id != c1.customer_id
    # Phone collision avoided by leaving phone_number None
    assert c2.phone_number is None


def test_customer_blocklist_and_no_show_enforcement(db_session):
    u = uuid.uuid4().hex[:6]
    c = customers_service.resolve_customer(
        database=db_session,
        first_name="Dave",
        email=f"dave_{u}@test.local",
    )
    db_session.commit()
    assert c.is_blocked is False

    # Allowed to order initially
    customers_service.ensure_customer_can_order(c)

    # Accumulate 5 no-shows
    for _ in range(5):
        customers_service.record_customer_no_show(db_session, c)
    db_session.commit()

    assert c.no_show_count == 5
    assert c.is_blocked is True

    # Attempting to order now raises HTTP 403
    with pytest.raises(HTTPException) as exc_info:
        customers_service.ensure_customer_can_order(c)
    assert exc_info.value.status_code == 403


def test_loyalty_earn_redeem_and_atomicity(db_session):
    u = uuid.uuid4().hex[:6]
    c = customers_service.resolve_customer(
        database=db_session,
        first_name="Eve",
        email=f"eve_{u}@test.local",
    )
    db_session.commit()

    # 1. Earn 100 points
    t_earn = customers_service.earn_loyalty_points(
        database=db_session,
        customer_id=c.customer_id,
        order_id=None,
        points=100,
        description="Welcome bonus",
    )
    db_session.commit()
    assert t_earn.transaction_type == LoyaltyTransactionType.EARN
    assert t_earn.points == 100
    assert c.loyalty_points_balance == 100

    # 2. Redeem 30 points (Atomicity check: starting 100, redeem 30 -> balance 70)
    t_redeem = customers_service.redeem_loyalty_points(
        database=db_session,
        customer_id=c.customer_id,
        order_id=None,
        points=30,
        description="Redeem for latte discount",
    )
    db_session.commit()

    db_session.refresh(c)
    assert c.loyalty_points_balance == 70
    assert t_redeem.transaction_type == LoyaltyTransactionType.REDEEM
    assert t_redeem.points == -30

    # Verify ledger history
    history = customers_service.list_loyalty_transactions(db_session, c.customer_id)
    assert len(history) == 2


def test_loyalty_insufficient_balance_rejection_and_rollback(db_session):
    u = uuid.uuid4().hex[:6]
    c = customers_service.resolve_customer(
        database=db_session,
        first_name="Frank",
        email=f"frank_{u}@test.local",
    )
    c.loyalty_points_balance = 20
    db_session.commit()

    # Attempt to redeem 50 points when balance is only 20
    with pytest.raises(HTTPException) as exc_info:
        customers_service.redeem_loyalty_points(
            database=db_session,
            customer_id=c.customer_id,
            order_id=None,
            points=50,
        )
    assert exc_info.value.status_code == 400
    assert "Insufficient loyalty points" in str(exc_info.value.detail)

    db_session.rollback()
    db_session.refresh(c)
    # Balance must remain unchanged
    assert c.loyalty_points_balance == 20

    # No partial ledger transaction committed
    tx_count = db_session.scalar(
        select(LoyaltyTransaction).where(LoyaltyTransaction.customer_id == c.customer_id)
    )
    assert tx_count is None


def test_loyalty_manual_adjustment_validation(db_session):
    u = uuid.uuid4().hex[:6]
    c = customers_service.resolve_customer(
        database=db_session,
        first_name="Grace",
        email=f"grace_{u}@test.local",
    )
    c.loyalty_points_balance = 50
    db_session.commit()

    # Adjustment requires description
    with pytest.raises(HTTPException) as exc_info:
        customers_service.adjust_loyalty_points(
            database=db_session,
            customer_id=c.customer_id,
            points=25,
            description="",
        )
    assert exc_info.value.status_code == 400
    assert "description is required" in str(exc_info.value.detail)

    # Valid positive adjustment
    t_adj = customers_service.adjust_loyalty_points(
        database=db_session,
        customer_id=c.customer_id,
        points=25,
        description="Customer service gesture",
    )
    assert t_adj.transaction_type == LoyaltyTransactionType.ADJUSTMENT
    assert t_adj.points == 25
    db_session.refresh(c)
    assert c.loyalty_points_balance == 75

    # Adjustment cannot cause negative balance
    with pytest.raises(HTTPException) as exc_info:
        customers_service.adjust_loyalty_points(
            database=db_session,
            customer_id=c.customer_id,
            points=-100,
            description="Deduct excess",
        )
    assert exc_info.value.status_code == 400
    assert "negative balance" in str(exc_info.value.detail)


def test_customer_routes_integration(db_session):
    cookies = create_or_get_manager_auth_cookie(db_session)

    u = uuid.uuid4().hex[:6]
    email = f"helen_{u}@test.local"

    # Pre-create customer
    c = customers_service.resolve_customer(
        database=db_session,
        first_name="Helen",
        email=email,
    )
    db_session.commit()

    # Lookup customer via API
    resp = client.get(f"/api/v1/customers/lookup?email={email}", cookies=cookies)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == email
    customer_id = data["customer_id"]

    # Get customer details
    resp = client.get(f"/api/v1/customers/{customer_id}", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["customer_id"] == customer_id

    # Manual loyalty adjustment via API
    adj_resp = client.post(
        f"/api/v1/customers/{customer_id}/loyalty/adjust",
        json={"points": 150, "description": "Promotion credit"},
        cookies=cookies,
    )
    assert adj_resp.status_code == 200
    assert adj_resp.json()["points"] == 150

    # Get customer loyalty balance
    loyalty_resp = client.get(f"/api/v1/customers/{customer_id}/loyalty", cookies=cookies)
    assert loyalty_resp.status_code == 200
    assert loyalty_resp.json()["loyalty_points_balance"] == 150
    assert len(loyalty_resp.json()["recent_transactions"]) >= 1

    # Redeem loyalty via API
    redeem_resp = client.post(
        f"/api/v1/customers/{customer_id}/loyalty/redeem",
        json={"points": 50, "description": "Redeem $0.50"},
        cookies=cookies,
    )
    assert redeem_resp.status_code == 200
    assert redeem_resp.json()["points"] == -50

    # Verify final balance is 100
    loyalty_resp2 = client.get(f"/api/v1/customers/{customer_id}/loyalty", cookies=cookies)
    assert loyalty_resp2.status_code == 200
    assert loyalty_resp2.json()["loyalty_points_balance"] == 100
