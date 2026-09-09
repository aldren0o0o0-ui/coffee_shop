from fastapi import APIRouter, HTTPException, Query, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.procurement.models import PurchaseRequestStatus
from app.modules.procurement.schemas import (
    PurchaseRequestCreate,
    PurchaseRequestRejectionRequest,
    PurchaseRequestResponse,
    PurchaseRequestUpdate,
)
from app.modules.procurement.service import (
    approve_purchase_request,
    create_purchase_request,
    get_purchase_request,
    list_purchase_requests,
    receive_purchase_request,
    reject_purchase_request,
    submit_purchase_request,
    update_purchase_request,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/procurement",
    tags=["Procurement & Purchasing"],
)


def verify_manager_or_owner(user):
    roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]
    if "owner" not in roles and "manager" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Owners and Managers have permission to approve or reject purchase requests.",
        )


@router.get("/requests", response_model=list[PurchaseRequestResponse])
def get_all_purchase_requests(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    status: PurchaseRequestStatus | None = Query(None, description="Filter by status"),
) -> list[PurchaseRequestResponse]:
    """
    Lists all purchase requests with optional status filtering.
    """
    return list_purchase_requests(database, status_filter=status)


@router.post("/requests", response_model=PurchaseRequestResponse, status_code=status.HTTP_201_CREATED)
def create_new_purchase_request(
    payload: PurchaseRequestCreate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Creates a new draft purchase request with inventory unit cost snapshots.
    """
    return create_purchase_request(database, payload, authentication.user)


@router.get("/requests/{request_id}", response_model=PurchaseRequestResponse)
def get_single_purchase_request(
    request_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Retrieves purchase request details and items by ID.
    """
    return get_purchase_request(database, request_id)


@router.put("/requests/{request_id}", response_model=PurchaseRequestResponse)
def update_draft_purchase_request(
    request_id: int,
    payload: PurchaseRequestUpdate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Updates items and expected delivery date on a draft purchase request.
    """
    return update_purchase_request(database, request_id, payload, authentication.user)


@router.post("/requests/{request_id}/submit", response_model=PurchaseRequestResponse)
def submit_draft_request(
    request_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Submits a draft purchase request for managerial approval.
    """
    return submit_purchase_request(database, request_id, authentication.user)


@router.post("/requests/{request_id}/approve", response_model=PurchaseRequestResponse)
def approve_request(
    request_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Approves a submitted purchase request (Owner / Manager only).
    """
    verify_manager_or_owner(authentication.user)
    return approve_purchase_request(database, request_id, authentication.user)


@router.post("/requests/{request_id}/reject", response_model=PurchaseRequestResponse)
def reject_request(
    request_id: int,
    payload: PurchaseRequestRejectionRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Rejects a submitted purchase request with a required non-empty reason (Owner / Manager only).
    """
    verify_manager_or_owner(authentication.user)
    return reject_purchase_request(database, request_id, payload.rejection_reason, authentication.user)


@router.post("/requests/{request_id}/receive", response_model=PurchaseRequestResponse)
def receive_approved_purchase(
    request_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PurchaseRequestResponse:
    """
    Receives an approved purchase order, atomically updates stock via InventoryService,
    and logs PURCHASE_IN transactions.
    """
    return receive_purchase_request(database, request_id, authentication.user)
