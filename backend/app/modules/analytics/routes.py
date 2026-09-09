from fastapi import APIRouter
from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.shared.dependencies import DatabaseDependency
from app.modules.analytics.schemas import (
    BaristaDashboardStats,
    CombinedDashboardResponse,
    InventoryStaffDashboardStats,
    OwnerDashboardStats,
)
from app.modules.analytics.service import (
    get_barista_queue,
    get_combined_dashboard_overview,
    get_inventory_dashboard_stats,
    get_owner_dashboard_stats,
)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/overview", response_model=CombinedDashboardResponse)
def get_dashboard_overview(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CombinedDashboardResponse:
    return get_combined_dashboard_overview(database, authentication.user)


@router.get("/barista-queue", response_model=BaristaDashboardStats)
def get_barista_live_queue(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> BaristaDashboardStats:
    return get_barista_queue(database)


@router.get("/inventory", response_model=InventoryStaffDashboardStats)
def get_inventory_stats(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> InventoryStaffDashboardStats:
    return get_inventory_dashboard_stats(database)
