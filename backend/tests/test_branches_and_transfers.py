import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import app
from app.modules.branches import service as branches_service
from app.modules.branches.models import Branch, BranchTransfer
from app.modules.branches.schemas import (
    BranchCreate,
    BranchTransferCreate,
    BranchTransferItemCreate,
)
from app.modules.inventory.models import InventoryItem
from tests.test_orders_and_fulfillment import (
    create_or_get_staff,
    setup_catalog_and_stock,
)

client = TestClient(app)


def test_default_branch_seeding_and_creation():
    session = SessionLocal()
    try:
        # 1. Default branch automatically seeded
        default_branch = branches_service.ensure_default_branch(session)
        assert default_branch.branch_id == 1
        assert default_branch.code == "MAIN"
        assert default_branch.is_active is True

        # 2. Owner creates a new branch
        owner, owner_cookies = create_or_get_staff(session, "Owner")
        code = f"BR_{uuid.uuid4().hex[:4].upper()}"
        resp = client.post(
            "/api/v1/branches",
            cookies=owner_cookies,
            json={
                "name": "Downtown Branch",
                "code": code,
                "address": "456 Downtown Ave, Makati",
                "timezone": "Asia/Manila",
                "is_active": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == code
        assert data["name"] == "Downtown Branch"

        # 3. Barista cannot create branch
        barista, barista_cookies = create_or_get_staff(session, "Barista")
        bad_resp = client.post(
            "/api/v1/branches",
            cookies=barista_cookies,
            json={
                "name": "Barista Branch",
                "code": "BARISTA1",
                "address": "Street 1",
            },
        )
        assert bad_resp.status_code == 403

        # 4. List branches
        list_resp = client.get("/api/v1/branches")
        assert list_resp.status_code == 200
        branches = list_resp.json()
        assert len(branches) >= 2
    finally:
        session.close()


def test_inter_branch_inventory_transfer_workflow():
    session = SessionLocal()
    try:
        owner, owner_cookies = create_or_get_staff(session, "Owner")
        _, _, _, inv_beans, _ = setup_catalog_and_stock(session)
        initial_stock = inv_beans.quantity_on_hand

        # Create branch 2
        branch_2 = branches_service.create_branch(
            session,
            BranchCreate(
                name="North Branch",
                code=f"NTH_{uuid.uuid4().hex[:4].upper()}",
                address="789 North Blvd, QC",
                timezone="Asia/Manila",
                is_active=True,
            ),
            owner,
        )

        # Add matching inventory item at destination branch to test two-way ledger receipt
        dest_beans = InventoryItem(
            item_name=inv_beans.item_name,
            unit_of_measure="kg",
            quantity_on_hand=Decimal("1.000"),
            reorder_level=Decimal("5.000"),
            unit_cost=Decimal("150.00"),
            branch_id=branch_2.branch_id,
            is_active=True,
        )
        session.add(dest_beans)
        session.commit()

        # 1. Initiate transfer from Branch 1 to Branch 2
        transfer_payload = {
            "source_branch_id": 1,
            "destination_branch_id": branch_2.branch_id,
            "notes": "Weekly beans restock",
            "items": [
                {
                    "inventory_item_id": inv_beans.inventory_item_id,
                    "quantity": 5.0,
                }
            ],
        }
        create_resp = client.post(
            "/api/v1/branches/transfers",
            cookies=owner_cookies,
            json=transfer_payload,
        )
        assert create_resp.status_code == 201
        transfer_data = create_resp.json()
        transfer_id = transfer_data["transfer_id"]
        assert transfer_data["status"] == "pending"

        # 2. Complete transfer
        complete_resp = client.post(
            f"/api/v1/branches/transfers/{transfer_id}/complete",
            cookies=owner_cookies,
        )
        assert complete_resp.status_code == 200
        completed_data = complete_resp.json()
        assert completed_data["status"] == "completed"

        # 3. Verify stock deduction on source and credit on destination
        session.refresh(inv_beans)
        session.refresh(dest_beans)
        assert inv_beans.quantity_on_hand == initial_stock - Decimal("5.000")
        assert dest_beans.quantity_on_hand == Decimal("6.000")

        # 4. Verify same-source/dest transfer rejected
        bad_transfer_resp = client.post(
            "/api/v1/branches/transfers",
            cookies=owner_cookies,
            json={
                "source_branch_id": 1,
                "destination_branch_id": 1,
                "items": [{"inventory_item_id": inv_beans.inventory_item_id, "quantity": 1.0}],
            },
        )
        assert bad_transfer_resp.status_code == 400
    finally:
        session.close()
