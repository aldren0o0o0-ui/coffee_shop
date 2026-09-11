from fastapi import APIRouter, Query, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.fulfilment import service as fulfilment_service
from app.modules.fulfilment.schemas import (
    FulfilmentQueueResponse,
    PickupBoardResponse,
    ReorderResponse,
    ReorderValidationRequest,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(prefix="/fulfilment", tags=["Fulfilment"])
customer_fulfilment_router = APIRouter(prefix="/customer", tags=["Customer Fulfilment"])


@router.get(
    "/queue",
    response_model=FulfilmentQueueResponse,
    status_code=status.HTTP_200_OK,
    summary="Get live prioritized barista preparation queue",
)
def get_preparation_queue(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    branch_id: int | None = Query(default=None),
) -> FulfilmentQueueResponse:
    """
    Returns prioritized live barista queue tickets with elapsed wait times
    and preparation time estimates.
    """
    return fulfilment_service.get_fulfilment_queue(database, branch_id=branch_id)


@customer_fulfilment_router.get(
    "/pickup-board",
    response_model=PickupBoardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get public customer-facing pickup board",
)
def get_customer_pickup_board(
    database: DatabaseDependency,
    branch_id: int | None = Query(default=None),
) -> PickupBoardResponse:
    """
    Public display endpoint: Exposes only pickup codes and status
    (Preparing / Ready for Pickup) without revealing customer PII.
    """
    return fulfilment_service.get_public_pickup_board(database, branch_id=branch_id)


@customer_fulfilment_router.post(
    "/orders/{order_id}/reorder",
    response_model=ReorderResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate and prepare one-tap reorder from past purchase",
)
def validate_reorder(
    order_id: int,
    payload: ReorderValidationRequest,
    database: DatabaseDependency,
) -> ReorderResponse:
    """
    Validates that a previously placed order's items are still available,
    checks that size adjustments & add-ons are valid, verifies ingredient inventory,
    and returns refreshed pricing.
    """
    return fulfilment_service.validate_and_prepare_reorder(
        database=database,
        order_id=order_id,
        customer_email=payload.email,
    )
