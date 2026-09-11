from fastapi import APIRouter, HTTPException, Query, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.inventory.schemas import (
    InventoryAdjustmentRequest,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    InventoryOption,
    InventoryForecastResponse,
    ForecastPurchaseRequest,
    InventoryTransactionDetailResponse,
)
from app.modules.inventory.service import (
    adjust_inventory_stock,
    create_inventory_item,
    get_inventory_options,
    get_inventory_forecast,
    list_inventory_items,
    list_inventory_transactions,
    update_inventory_item,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory & Stock Management"],
)


def verify_inventory_access(user):
    roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]
    if not ({"owner", "manager", "inventory staff"} & set(roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Owners, Managers, and Inventory Staff have access to manage inventory.",
        )


@router.get("/options", response_model=list[InventoryOption])
def fetch_inventory_options_route(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[InventoryOption]:
    """
    Returns active inventory items for recipe and stock selection.
    """
    return get_inventory_options(database)


@router.get("/items", response_model=list[InventoryItemResponse])
def fetch_inventory_items_route(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[InventoryItemResponse]:
    """
    Lists all inventory items.
    """
    return list_inventory_items(database)


@router.get("/forecast", response_model=InventoryForecastResponse)
def fetch_inventory_forecast_route(authentication: CurrentAuthenticationDependency, database: DatabaseDependency, days: int = Query(default=7, ge=1, le=30)) -> InventoryForecastResponse:
    verify_inventory_access(authentication.user)
    return get_inventory_forecast(database, days)


@router.post("/forecast/purchase-request", status_code=status.HTTP_201_CREATED)
def create_forecast_purchase_request(payload: ForecastPurchaseRequest, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    """Convert current forecast recommendations into an editable procurement draft."""
    verify_inventory_access(authentication.user)
    from app.modules.procurement.schemas import PurchaseRequestCreate, PurchaseRequestItemCreate
    from app.modules.procurement.service import create_purchase_request
    forecast = get_inventory_forecast(database, payload.days)
    items = [PurchaseRequestItemCreate(inventory_item_id=item.inventory_item_id, quantity_requested=item.suggested_purchase_quantity) for item in forecast.items if item.suggested_purchase_quantity > 0]
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No replenishment recommendations are currently required.")
    return create_purchase_request(database, PurchaseRequestCreate(items=items), authentication.user)


@router.post("/items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_new_inventory_item_route(
    payload: InventoryItemCreate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> InventoryItemResponse:
    """
    Creates a new inventory stock item (Owner, Manager, Inventory Staff).
    """
    verify_inventory_access(authentication.user)
    return create_inventory_item(database, payload, authentication.user.user_id)


@router.patch("/items/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item_route(
    item_id: int,
    payload: InventoryItemUpdate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> InventoryItemResponse:
    """
    Updates an inventory item's details, thresholds, and costs (Owner, Manager, Inventory Staff).
    """
    verify_inventory_access(authentication.user)
    try:
        return update_inventory_item(database, item_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/items/{item_id}/adjust", response_model=InventoryItemResponse)
def adjust_inventory_item_route(
    item_id: int,
    payload: InventoryAdjustmentRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> InventoryItemResponse:
    """
    Records an inventory stock adjustment (addition, restock, waste, deduction).
    """
    verify_inventory_access(authentication.user)
    try:
        item, _ = adjust_inventory_stock(
            database=database,
            item_id=item_id,
            quantity_change=payload.quantity_change,
            transaction_type=payload.transaction_type,
            created_by_user_id=authentication.user.user_id,
            notes=payload.notes,
        )
        return item
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/transactions", response_model=list[InventoryTransactionDetailResponse])
def get_inventory_transactions_route(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    limit: int = Query(default=50, ge=1, le=100),
    item_id: int | None = Query(default=None),
) -> list[InventoryTransactionDetailResponse]:
    """
    Retrieves recent inventory transactions audit logs.
    """
    verify_inventory_access(authentication.user)
    txs = list_inventory_transactions(database, limit=limit, item_id=item_id)
    return [
        InventoryTransactionDetailResponse(
            inventory_transaction_id=tx.inventory_transaction_id,
            inventory_item_id=tx.inventory_item_id,
            item_name=tx.inventory_item.item_name if tx.inventory_item else "Unknown Item",
            unit_of_measure=tx.inventory_item.unit_of_measure if tx.inventory_item else "",
            transaction_type=tx.transaction_type,
            quantity_change=tx.quantity_change,
            reference_type=tx.reference_type,
            reference_id=tx.reference_id,
            notes=tx.notes,
            created_by=tx.created_by,
            creator_name=f"{tx.creator.first_name} {tx.creator.last_name}" if tx.creator else "System",
            transaction_date=tx.transaction_date,
            created_at=tx.created_at,
        )
        for tx in txs
    ]
