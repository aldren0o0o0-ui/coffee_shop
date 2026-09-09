import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.database.session import SessionLocal
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.procurement.models import (
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseRequestStatus,
)
from app.modules.users.models import Role, User, UserRole
from app.core.security import hash_password

client = TestClient(app)


def setup_procurement_test_data():
    db = SessionLocal()

    # 1. Create Dedicated Test Inventory Item
    inv_item = InventoryItem(
        item_name=f"Procurement Test Item {uuid.uuid4().hex[:6]}",
        unit_of_measure="kg",
        quantity_on_hand=Decimal("5.000"),
        reorder_level=Decimal("2.000"),
        unit_cost=Decimal("15.50"),
        is_active=True,
    )
    db.add(inv_item)
    db.flush()

    # 2. Ensure Roles Exist
    roles = {}
    for role_name in ["Owner", "Manager", "Inventory Staff", "Barista"]:
        role = db.query(Role).filter(Role.role_name == role_name).first()
        if not role:
            role = Role(role_name=role_name, description=role_name, is_active=True)
            db.add(role)
            db.flush()
        roles[role_name] = role

    # 3. Create Manager User
    mgr_username = f"proc_mgr_{uuid.uuid4().hex[:6]}"
    mgr_user = User(
        username=mgr_username,
        email=f"{mgr_username}@brewflow.local",
        password_hash=hash_password("ManagerPassword123!"),
        first_name="Marcus",
        last_name="Manager",
        is_active=True,
    )
    db.add(mgr_user)
    db.flush()
    db.add(UserRole(user_id=mgr_user.user_id, role_id=roles["Manager"].role_id, is_active=True))

    # 4. Create Inventory Staff User
    inv_username = f"proc_staff_{uuid.uuid4().hex[:6]}"
    inv_user = User(
        username=inv_username,
        email=f"{inv_username}@brewflow.local",
        password_hash=hash_password("StaffPassword123!"),
        first_name="Ivan",
        last_name="Inventory",
        is_active=True,
    )
    db.add(inv_user)
    db.flush()
    db.add(UserRole(user_id=inv_user.user_id, role_id=roles["Inventory Staff"].role_id, is_active=True))

    # 5. Create Barista User (unauthorized for approvals)
    bar_username = f"proc_bar_{uuid.uuid4().hex[:6]}"
    bar_user = User(
        username=bar_username,
        email=f"{bar_username}@brewflow.local",
        password_hash=hash_password("BaristaPassword123!"),
        first_name="Bella",
        last_name="Barista",
        is_active=True,
    )
    db.add(bar_user)
    db.flush()
    db.add(UserRole(user_id=bar_user.user_id, role_id=roles["Barista"].role_id, is_active=True))

    db.commit()
    inv_id = inv_item.inventory_item_id
    db.close()

    return {
        "inv_id": inv_id,
        "manager": (mgr_username, "ManagerPassword123!"),
        "staff": (inv_username, "StaffPassword123!"),
        "barista": (bar_username, "BaristaPassword123!"),
    }


def test_create_draft_purchase_request_and_item_calculations():
    data = setup_procurement_test_data()
    staff_user, staff_pass = data["staff"]
    inv_id = data["inv_id"]

    # Login as inventory staff
    login_res = client.post("/api/v1/auth/login", json={"identifier": staff_user, "password": staff_pass})
    assert login_res.status_code == 200

    payload = {
        "expected_delivery_date": "2026-09-15",
        "items": [
            {
                "inventory_item_id": inv_id,
                "quantity_requested": 10.0,
                # unit_cost omitted to test default snapshot from InventoryItem (15.50)
            }
        ],
    }

    res = client.post("/api/v1/procurement/requests", json=payload)
    assert res.status_code == 201, res.text
    body = res.json()

    assert body["request_status"] == "draft"
    assert Decimal(str(body["total_amount"])) == Decimal("155.00")
    assert len(body["items"]) == 1
    assert body["items"][0]["inventory_item_id"] == inv_id
    assert Decimal(str(body["items"][0]["unit_cost"])) == Decimal("15.50")
    assert Decimal(str(body["items"][0]["subtotal"])) == Decimal("155.00")


def test_submit_draft_purchase_request_and_empty_guard():
    data = setup_procurement_test_data()
    staff_user, staff_pass = data["staff"]
    inv_id = data["inv_id"]

    client.post("/api/v1/auth/login", json={"identifier": staff_user, "password": staff_pass})

    # 1. Create empty draft request
    res_empty = client.post("/api/v1/procurement/requests", json={"items": []})
    assert res_empty.status_code == 201
    empty_req_id = res_empty.json()["purchase_request_id"]

    # Submitting empty request must fail
    res_empty_submit = client.post(f"/api/v1/procurement/requests/{empty_req_id}/submit")
    assert res_empty_submit.status_code == 400
    assert "empty" in res_empty_submit.json()["detail"].lower()

    # 2. Create valid draft request and submit
    res_valid = client.post(
        "/api/v1/procurement/requests",
        json={"items": [{"inventory_item_id": inv_id, "quantity_requested": 4.0}]},
    )
    assert res_valid.status_code == 201
    valid_req_id = res_valid.json()["purchase_request_id"]

    res_submit = client.post(f"/api/v1/procurement/requests/{valid_req_id}/submit")
    assert res_submit.status_code == 200
    assert res_submit.json()["request_status"] == "submitted"


def test_approve_and_reject_workflow_with_reason_validation():
    data = setup_procurement_test_data()
    staff_user, staff_pass = data["staff"]
    mgr_user, mgr_pass = data["manager"]
    bar_user, bar_pass = data["barista"]
    inv_id = data["inv_id"]

    # Staff creates and submits request
    client.post("/api/v1/auth/login", json={"identifier": staff_user, "password": staff_pass})
    res_req = client.post(
        "/api/v1/procurement/requests",
        json={"items": [{"inventory_item_id": inv_id, "quantity_requested": 2.0}]},
    )
    req_id = res_req.json()["purchase_request_id"]
    client.post(f"/api/v1/procurement/requests/{req_id}/submit")

    # Barista attempts to approve -> HTTP 403
    client.post("/api/v1/auth/login", json={"identifier": bar_user, "password": bar_pass})
    res_bar_approve = client.post(f"/api/v1/procurement/requests/{req_id}/approve")
    assert res_bar_approve.status_code == 403

    # Manager approves -> Success
    client.post("/api/v1/auth/login", json={"identifier": mgr_user, "password": mgr_pass})
    res_mgr_approve = client.post(f"/api/v1/procurement/requests/{req_id}/approve")
    assert res_mgr_approve.status_code == 200
    assert res_mgr_approve.json()["request_status"] == "approved"

    # Test rejection with reason requirement
    res_req2 = client.post(
        "/api/v1/procurement/requests",
        json={"items": [{"inventory_item_id": inv_id, "quantity_requested": 8.0}]},
    )
    req_id2 = res_req2.json()["purchase_request_id"]
    client.post(f"/api/v1/procurement/requests/{req_id2}/submit")

    # Rejection with empty reason fails
    res_empty_reject = client.post(
        f"/api/v1/procurement/requests/{req_id2}/reject",
        json={"rejection_reason": "   "},
    )
    assert res_empty_reject.status_code == 422 or res_empty_reject.status_code == 400

    # Rejection with valid reason succeeds
    res_valid_reject = client.post(
        f"/api/v1/procurement/requests/{req_id2}/reject",
        json={"rejection_reason": "Budget limit exceeded for Q3"},
    )
    assert res_valid_reject.status_code == 200
    assert res_valid_reject.json()["request_status"] == "rejected"
    assert res_valid_reject.json()["rejection_reason"] == "Budget limit exceeded for Q3"


def test_receive_approved_purchase_increases_stock_and_logs_ledger():
    data = setup_procurement_test_data()
    mgr_user, mgr_pass = data["manager"]
    inv_id = data["inv_id"]

    # Initial stock is 5.000 kg
    db = SessionLocal()
    initial_inv = db.get(InventoryItem, inv_id)
    assert initial_inv.quantity_on_hand == Decimal("5.000")
    db.close()

    # Manager logs in, creates, submits, and approves request for +10.000 kg
    client.post("/api/v1/auth/login", json={"identifier": mgr_user, "password": mgr_pass})
    res_create = client.post(
        "/api/v1/procurement/requests",
        json={"items": [{"inventory_item_id": inv_id, "quantity_requested": 10.0}]},
    )
    req_id = res_create.json()["purchase_request_id"]
    client.post(f"/api/v1/procurement/requests/{req_id}/submit")
    client.post(f"/api/v1/procurement/requests/{req_id}/approve")

    # Receive purchase request
    res_receive = client.post(f"/api/v1/procurement/requests/{req_id}/receive")
    assert res_receive.status_code == 200, res_receive.text
    assert res_receive.json()["request_status"] == "received"

    # Verify inventory was incremented by exactly 10.000 kg (5 + 10 = 15 kg)
    db = SessionLocal()
    updated_inv = db.get(InventoryItem, inv_id)
    assert updated_inv.quantity_on_hand == Decimal("15.000")

    # Verify InventoryTransaction was created with PURCHASE_IN
    tx = db.scalar(
        select(InventoryTransaction)
        .where(
            InventoryTransaction.inventory_item_id == inv_id,
            InventoryTransaction.reference_type == "PurchaseRequest",
            InventoryTransaction.reference_id == req_id,
        )
    )
    assert tx is not None, "PURCHASE_IN transaction not found!"
    assert tx.transaction_type == InventoryTransactionType.PURCHASE_IN
    assert tx.quantity_change == Decimal("10.000")
    db.close()

    # Double receive must be rejected
    res_double_receive = client.post(f"/api/v1/procurement/requests/{req_id}/receive")
    assert res_double_receive.status_code == 400
    assert "already been received" in res_double_receive.json()["detail"].lower()

    # Verify inventory did NOT double
    db = SessionLocal()
    inv_check = db.get(InventoryItem, inv_id)
    assert inv_check.quantity_on_hand == Decimal("15.000")
    db.close()
