from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.modules.auth.dependencies import (
    CurrentAuthenticationDependency,
    OwnerAuthenticationDependency,
)
from app.modules.branches import service as branches_service
from app.modules.branches.schemas import (
    BranchCreate,
    BranchResponse,
    BranchTransferCreate,
    BranchTransferResponse,
    BranchUpdate,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/branches",
    tags=["Branches & Multi-Branch"],
)


@router.get(
    "",
    response_model=list[BranchResponse],
    status_code=status.HTTP_200_OK,
    summary="List operational store branches",
)
def list_branches(
    database: DatabaseDependency,
    active_only: bool = Query(default=False),
) -> list[BranchResponse]:
    return branches_service.list_branches(database, active_only=active_only)


@router.post(
    "",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new store branch (Owner only)",
)
def create_branch(
    payload: BranchCreate,
    authentication: OwnerAuthenticationDependency,
    database: DatabaseDependency,
) -> BranchResponse:
    return branches_service.create_branch(database, payload, authentication.user)


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
    status_code=status.HTTP_200_OK,
    summary="Get branch details",
)
def get_branch_details(
    branch_id: int,
    database: DatabaseDependency,
) -> BranchResponse:
    return branches_service.get_branch(database, branch_id)


@router.put(
    "/{branch_id}",
    response_model=BranchResponse,
    status_code=status.HTTP_200_OK,
    summary="Update branch settings (Owner only)",
)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    authentication: OwnerAuthenticationDependency,
    database: DatabaseDependency,
) -> BranchResponse:
    return branches_service.update_branch(database, branch_id, payload, authentication.user)


# =========================================================================
# Inter-Branch Inventory Transfers
# =========================================================================

@router.get(
    "/transfers/list",
    response_model=list[BranchTransferResponse],
    status_code=status.HTTP_200_OK,
    summary="List inter-branch inventory transfers",
)
def list_transfers(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    branch_id: int | None = Query(default=None),
) -> list[BranchTransferResponse]:
    transfers = branches_service.list_branch_transfers(database, branch_id=branch_id)
    return [
        BranchTransferResponse(
            transfer_id=t.transfer_id,
            source_branch_id=t.source_branch_id,
            destination_branch_id=t.destination_branch_id,
            source_branch_name=t.source_branch.name if t.source_branch else None,
            destination_branch_name=t.destination_branch.name if t.destination_branch else None,
            status=t.status,
            requested_by_user_id=t.requested_by_user_id,
            approved_by_user_id=t.approved_by_user_id,
            notes=t.notes,
            created_at=t.created_at,
            items=[
                {
                    "transfer_item_id": item.transfer_item_id,
                    "inventory_item_id": item.inventory_item_id,
                    "item_name": item.inventory_item.item_name if item.inventory_item else None,
                    "quantity": item.quantity,
                }
                for item in t.items
            ],
        )
        for t in transfers
    ]


@router.post(
    "/transfers",
    response_model=BranchTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate an inter-branch stock transfer (Manager/Owner)",
)
def create_transfer(
    payload: BranchTransferCreate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> BranchTransferResponse:
    user_roles = [r.role.role_name.lower() for r in authentication.user.user_roles if r.is_active and r.role.is_active]
    if not (set(user_roles) & {"owner", "manager"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and owners can initiate stock transfers between branches.",
        )
    t = branches_service.create_branch_transfer(database, payload, authentication.user)
    return BranchTransferResponse(
        transfer_id=t.transfer_id,
        source_branch_id=t.source_branch_id,
        destination_branch_id=t.destination_branch_id,
        status=t.status,
        requested_by_user_id=t.requested_by_user_id,
        approved_by_user_id=t.approved_by_user_id,
        notes=t.notes,
        created_at=t.created_at,
        items=[
            {
                "transfer_item_id": item.transfer_item_id,
                "inventory_item_id": item.inventory_item_id,
                "quantity": item.quantity,
            }
            for item in t.items
        ],
    )


@router.post(
    "/transfers/{transfer_id}/complete",
    response_model=BranchTransferResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve and finalize an inter-branch stock transfer (Manager/Owner)",
)
def complete_transfer(
    transfer_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> BranchTransferResponse:
    user_roles = [r.role.role_name.lower() for r in authentication.user.user_roles if r.is_active and r.role.is_active]
    if not (set(user_roles) & {"owner", "manager"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and owners can complete stock transfers.",
        )
    t = branches_service.complete_branch_transfer(database, transfer_id, authentication.user)
    return BranchTransferResponse(
        transfer_id=t.transfer_id,
        source_branch_id=t.source_branch_id,
        destination_branch_id=t.destination_branch_id,
        source_branch_name=t.source_branch.name if t.source_branch else None,
        destination_branch_name=t.destination_branch.name if t.destination_branch else None,
        status=t.status,
        requested_by_user_id=t.requested_by_user_id,
        approved_by_user_id=t.approved_by_user_id,
        notes=t.notes,
        created_at=t.created_at,
        items=[
            {
                "transfer_item_id": item.transfer_item_id,
                "inventory_item_id": item.inventory_item_id,
                "item_name": item.inventory_item.item_name if item.inventory_item else None,
                "quantity": item.quantity,
            }
            for item in t.items
        ],
    )
