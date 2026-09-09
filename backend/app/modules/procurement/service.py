from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.inventory.models import InventoryItem
from app.modules.inventory.service import receive_stock
from app.modules.procurement.models import (
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseRequestStatus,
)
from app.modules.procurement.schemas import (
    PurchaseRequestCreate,
    PurchaseRequestItemResponse,
    PurchaseRequestResponse,
    PurchaseRequestUpdate,
)
from app.modules.users.models import User


def _serialize_purchase_request(req: PurchaseRequest) -> PurchaseRequestResponse:
    requester_name = None
    if req.requester:
        requester_name = f"{req.requester.first_name} {req.requester.last_name or ''}".strip()

    items = []
    for item in req.items:
        item_name = item.inventory_item.item_name if item.inventory_item else None
        unit_of_measure = item.inventory_item.unit_of_measure if item.inventory_item else None
        items.append(
            PurchaseRequestItemResponse(
                purchase_request_item_id=item.purchase_request_item_id,
                purchase_request_id=item.purchase_request_id,
                inventory_item_id=item.inventory_item_id,
                item_name=item_name,
                unit_of_measure=unit_of_measure,
                quantity_requested=item.quantity_requested,
                unit_cost=item.unit_cost,
                subtotal=item.subtotal,
            )
        )

    return PurchaseRequestResponse(
        purchase_request_id=req.purchase_request_id,
        requested_by=req.requested_by,
        requester_name=requester_name,
        request_status=req.request_status,
        rejection_reason=req.rejection_reason,
        request_date=req.request_date,
        expected_delivery_date=req.expected_delivery_date,
        total_amount=req.total_amount,
        items=items,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def list_purchase_requests(
    database: Session,
    status_filter: PurchaseRequestStatus | None = None,
) -> list[PurchaseRequestResponse]:
    stmt = (
        select(PurchaseRequest)
        .options(
            selectinload(PurchaseRequest.requester),
            selectinload(PurchaseRequest.items).selectinload(PurchaseRequestItem.inventory_item),
        )
        .order_by(PurchaseRequest.request_date.desc())
    )
    if status_filter:
        stmt = stmt.where(PurchaseRequest.request_status == status_filter)

    requests = list(database.scalars(stmt).all())
    return [_serialize_purchase_request(r) for r in requests]


def get_purchase_request(
    database: Session,
    request_id: int,
) -> PurchaseRequestResponse:
    stmt = (
        select(PurchaseRequest)
        .options(
            selectinload(PurchaseRequest.requester),
            selectinload(PurchaseRequest.items).selectinload(PurchaseRequestItem.inventory_item),
        )
        .where(PurchaseRequest.purchase_request_id == request_id)
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )
    return _serialize_purchase_request(req)


def create_purchase_request(
    database: Session,
    payload: PurchaseRequestCreate,
    current_user: User,
) -> PurchaseRequestResponse:
    now = datetime.now(timezone.utc)
    total_amount = Decimal("0.00")
    items_to_add = []

    req = PurchaseRequest(
        requested_by=current_user.user_id,
        request_status=PurchaseRequestStatus.DRAFT,
        expected_delivery_date=payload.expected_delivery_date,
        total_amount=Decimal("0.00"),
        request_date=now,
    )
    database.add(req)
    database.flush()

    for item_data in payload.items:
        inv_item = database.get(InventoryItem, item_data.inventory_item_id)
        if not inv_item or not inv_item.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory item ID {item_data.inventory_item_id} not found or inactive.",
            )

        unit_cost = item_data.unit_cost if item_data.unit_cost is not None else inv_item.unit_cost
        subtotal = (item_data.quantity_requested * unit_cost).quantize(Decimal("0.01"))
        total_amount += subtotal

        req_item = PurchaseRequestItem(
            purchase_request_id=req.purchase_request_id,
            inventory_item_id=inv_item.inventory_item_id,
            quantity_requested=item_data.quantity_requested,
            unit_cost=unit_cost,
            subtotal=subtotal,
        )
        database.add(req_item)
        items_to_add.append(req_item)

    req.total_amount = total_amount
    database.commit()
    database.refresh(req)
    return get_purchase_request(database, req.purchase_request_id)


def update_purchase_request(
    database: Session,
    request_id: int,
    payload: PurchaseRequestUpdate,
    current_user: User,
) -> PurchaseRequestResponse:
    stmt = (
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.items))
        .where(PurchaseRequest.purchase_request_id == request_id)
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )

    if req.request_status != PurchaseRequestStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only DRAFT purchase requests can be edited (current status: {req.request_status.value}).",
        )

    req.expected_delivery_date = payload.expected_delivery_date

    # Delete existing items
    for old_item in req.items:
        database.delete(old_item)
    database.flush()

    total_amount = Decimal("0.00")
    for item_data in payload.items:
        inv_item = database.get(InventoryItem, item_data.inventory_item_id)
        if not inv_item or not inv_item.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory item ID {item_data.inventory_item_id} not found or inactive.",
            )

        unit_cost = item_data.unit_cost if item_data.unit_cost is not None else inv_item.unit_cost
        subtotal = (item_data.quantity_requested * unit_cost).quantize(Decimal("0.01"))
        total_amount += subtotal

        req_item = PurchaseRequestItem(
            purchase_request_id=req.purchase_request_id,
            inventory_item_id=inv_item.inventory_item_id,
            quantity_requested=item_data.quantity_requested,
            unit_cost=unit_cost,
            subtotal=subtotal,
        )
        database.add(req_item)

    req.total_amount = total_amount
    database.commit()
    return get_purchase_request(database, req.purchase_request_id)


def submit_purchase_request(
    database: Session,
    request_id: int,
    current_user: User,
) -> PurchaseRequestResponse:
    stmt = (
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.items))
        .where(PurchaseRequest.purchase_request_id == request_id)
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )

    if req.request_status != PurchaseRequestStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit purchase request: invalid status '{req.request_status.value}' (expected 'draft').",
        )

    if not req.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit an empty purchase request. Please add at least one line item.",
        )

    req.request_status = PurchaseRequestStatus.SUBMITTED
    database.commit()
    return get_purchase_request(database, req.purchase_request_id)


def approve_purchase_request(
    database: Session,
    request_id: int,
    current_user: User,
) -> PurchaseRequestResponse:
    stmt = (
        select(PurchaseRequest)
        .where(PurchaseRequest.purchase_request_id == request_id)
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )

    if req.request_status != PurchaseRequestStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve purchase request: status is '{req.request_status.value}' (expected 'submitted').",
        )

    req.request_status = PurchaseRequestStatus.APPROVED
    database.commit()
    return get_purchase_request(database, req.purchase_request_id)


def reject_purchase_request(
    database: Session,
    request_id: int,
    rejection_reason: str,
    current_user: User,
) -> PurchaseRequestResponse:
    if not rejection_reason or not rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty rejection reason is required when rejecting a purchase request.",
        )

    stmt = (
        select(PurchaseRequest)
        .where(PurchaseRequest.purchase_request_id == request_id)
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )

    if req.request_status != PurchaseRequestStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject purchase request: status is '{req.request_status.value}' (expected 'submitted').",
        )

    req.request_status = PurchaseRequestStatus.REJECTED
    req.rejection_reason = rejection_reason.strip()
    database.commit()
    return get_purchase_request(database, req.purchase_request_id)


def receive_purchase_request(
    database: Session,
    request_id: int,
    current_user: User,
) -> PurchaseRequestResponse:
    """
    Atomically receives an approved purchase request, locks inventory rows deterministically,
    delegates stock increases to InventoryService, and marks request as RECEIVED.
    """
    now = datetime.now(timezone.utc)

    # 1. Lock PurchaseRequest row to prevent concurrent double-receiving
    stmt = (
        select(PurchaseRequest)
        .options(
            selectinload(PurchaseRequest.items).selectinload(PurchaseRequestItem.inventory_item)
        )
        .where(PurchaseRequest.purchase_request_id == request_id)
        .with_for_update()
    )
    req = database.scalar(stmt)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request #{request_id} not found.",
        )

    if req.request_status == PurchaseRequestStatus.RECEIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Purchase request #{request_id} has already been received.",
        )

    if req.request_status != PurchaseRequestStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot receive purchase request: status is '{req.request_status.value}' (expected 'approved').",
        )

    # 2. Lock required inventory rows in deterministic ascending ID order
    sorted_items = sorted(req.items, key=lambda x: x.inventory_item_id)
    sorted_item_ids = [item.inventory_item_id for item in sorted_items]

    if sorted_item_ids:
        database.scalars(
            select(InventoryItem)
            .where(InventoryItem.inventory_item_id.in_(sorted_item_ids))
            .order_by(InventoryItem.inventory_item_id.asc())
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()

    # 3. Increase stock and create PURCHASE_IN ledger transaction via InventoryService
    for item in sorted_items:
        receive_stock(
            database=database,
            item_id=item.inventory_item_id,
            quantity=item.quantity_requested,
            created_by=current_user.user_id,
            reference_type="PurchaseRequest",
            reference_id=req.purchase_request_id,
            notes=f"Purchase request #{req.purchase_request_id} received into inventory",
            now=now,
        )

    req.request_status = PurchaseRequestStatus.RECEIVED
    database.commit()
    return get_purchase_request(database, req.purchase_request_id)
