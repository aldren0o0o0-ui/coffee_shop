from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.branches.models import Branch, BranchTransfer, BranchTransferItem
from app.modules.branches.schemas import (
    BranchCreate,
    BranchTransferCreate,
    BranchUpdate,
)
from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_default_branch(database: Session) -> Branch:
    """
    Guarantees the existence of the default primary branch (id=1, code='MAIN').
    """
    branch = database.get(Branch, 1)
    if not branch:
        branch = database.scalar(select(Branch).where(Branch.code == "MAIN"))
    if not branch:
        branch = Branch(
            branch_id=1,
            name="Main Branch",
            code="MAIN",
            address="123 Artisan Coffee St., Manila",
            timezone="Asia/Manila",
            is_active=True,
            operational_settings='{"opening_time": "07:00", "closing_time": "22:00"}',
        )
        database.add(branch)
        database.flush()
        database.commit()
        database.refresh(branch)
    elif not branch.name or len(branch.name) < 2:
        branch.name = "Main Branch"
        database.flush()
        database.commit()
        database.refresh(branch)
        logger.info("Default primary branch initialized (branch_id=1, code='MAIN').")
    return branch


def list_branches(database: Session, active_only: bool = False) -> list[Branch]:
    ensure_default_branch(database)
    stmt = select(Branch).order_by(Branch.branch_id.asc())
    if active_only:
        stmt = stmt.where(Branch.is_active.is_(True))
    return list(database.scalars(stmt).all())


def get_branch(database: Session, branch_id: int) -> Branch:
    ensure_default_branch(database)
    branch = database.get(Branch, branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with ID {branch_id} not found.",
        )
    return branch


def create_branch(database: Session, payload: BranchCreate, actor: User) -> Branch:
    ensure_default_branch(database)
    code_normalized = payload.code.strip().upper()
    existing = database.scalar(select(Branch).where(Branch.code == code_normalized))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A branch with code '{code_normalized}' already exists.",
        )

    branch = Branch(
        name=payload.name.strip(),
        code=code_normalized,
        address=payload.address.strip(),
        timezone=payload.timezone,
        is_active=payload.is_active,
        operational_settings=payload.operational_settings,
    )
    database.add(branch)
    database.commit()
    database.refresh(branch)
    return branch


def update_branch(
    database: Session,
    branch_id: int,
    payload: BranchUpdate,
    actor: User,
) -> Branch:
    branch = get_branch(database, branch_id)

    if payload.name is not None:
        branch.name = payload.name.strip()
    if payload.address is not None:
        branch.address = payload.address.strip()
    if payload.timezone is not None:
        branch.timezone = payload.timezone
    if payload.is_active is not None:
        branch.is_active = payload.is_active
    if payload.operational_settings is not None:
        branch.operational_settings = payload.operational_settings

    database.commit()
    database.refresh(branch)
    return branch


def create_branch_transfer(
    database: Session,
    payload: BranchTransferCreate,
    actor: User,
) -> BranchTransfer:
    if payload.source_branch_id == payload.destination_branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination branches must be distinct.",
        )

    get_branch(database, payload.source_branch_id)
    get_branch(database, payload.destination_branch_id)

    transfer = BranchTransfer(
        source_branch_id=payload.source_branch_id,
        destination_branch_id=payload.destination_branch_id,
        status="pending",
        requested_by_user_id=actor.user_id,
        notes=payload.notes,
    )
    database.add(transfer)
    database.flush()

    for item_data in payload.items:
        inv_item = database.get(InventoryItem, item_data.inventory_item_id)
        if not inv_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory item ID {item_data.inventory_item_id} not found.",
            )

        transfer_item = BranchTransferItem(
            transfer_id=transfer.transfer_id,
            inventory_item_id=item_data.inventory_item_id,
            quantity=item_data.quantity,
        )
        database.add(transfer_item)

    database.commit()
    database.refresh(transfer)
    return transfer


def complete_branch_transfer(
    database: Session,
    transfer_id: int,
    actor: User,
) -> BranchTransfer:
    stmt = (
        select(BranchTransfer)
        .options(
            selectinload(BranchTransfer.items).selectinload(BranchTransferItem.inventory_item),
            selectinload(BranchTransfer.source_branch),
            selectinload(BranchTransfer.destination_branch),
        )
        .where(BranchTransfer.transfer_id == transfer_id)
    )
    transfer = database.scalar(stmt)
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer record not found.",
        )

    if transfer.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete transfer in status '{transfer.status}'.",
        )

    now = utc_now()

    # Verify and deduct from source items
    for item in transfer.items:
        inv_item = item.inventory_item
        if inv_item.quantity_on_hand < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{inv_item.item_name}' (available: {inv_item.quantity_on_hand}, required: {item.quantity}).",
            )

        # In a multi-branch deployment with unified catalog:
        # Deduct quantity from source inventory item ledger with audit transaction
        inv_item.quantity_on_hand -= item.quantity

        tx_out = InventoryTransaction(
            inventory_item_id=inv_item.inventory_item_id,
            transaction_type=InventoryTransactionType.USAGE_OUT,
            quantity_change=-item.quantity,
            notes=f"Branch Transfer #{transfer.transfer_id} to {transfer.destination_branch.name}",
            created_by=actor.user_id,
            transaction_date=now,
        )
        database.add(tx_out)

        # If destination branch maintains an inventory record for this item, credit it
        dest_item = database.scalar(
            select(InventoryItem).where(
                InventoryItem.branch_id == transfer.destination_branch_id,
                InventoryItem.item_name == inv_item.item_name,
                InventoryItem.is_active.is_(True),
            ).limit(1)
        )
        if dest_item:
            dest_item.quantity_on_hand += item.quantity
            tx_in = InventoryTransaction(
                inventory_item_id=dest_item.inventory_item_id,
                transaction_type=InventoryTransactionType.ADJUSTMENT,
                quantity_change=item.quantity,
                notes=f"Branch Transfer #{transfer.transfer_id} from {transfer.source_branch.name}",
                created_by=actor.user_id,
                transaction_date=now,
            )
            database.add(tx_in)

    transfer.status = "completed"
    transfer.approved_by_user_id = actor.user_id
    database.commit()
    database.refresh(transfer)
    return transfer


def list_branch_transfers(
    database: Session,
    branch_id: int | None = None,
) -> list[BranchTransfer]:
    stmt = (
        select(BranchTransfer)
        .options(
            selectinload(BranchTransfer.items).selectinload(BranchTransferItem.inventory_item),
            selectinload(BranchTransfer.source_branch),
            selectinload(BranchTransfer.destination_branch),
        )
        .order_by(BranchTransfer.created_at.desc())
    )
    if branch_id is not None:
        stmt = stmt.where(
            (BranchTransfer.source_branch_id == branch_id)
            | (BranchTransfer.destination_branch_id == branch_id)
        )
    return list(database.scalars(stmt).all())
