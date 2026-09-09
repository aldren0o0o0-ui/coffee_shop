from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.inventory.schemas import InventoryItemResponse, InventoryOption
from app.modules.inventory.service import get_inventory_options, list_inventory_items
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory & Stock Management"],
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
