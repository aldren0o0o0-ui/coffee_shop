from fastapi import APIRouter, HTTPException, Query, status

from app.modules.analytics.schemas import (
    BaristaDashboardStats,
    CombinedDashboardResponse,
    InventoryStaffDashboardStats,
    StoreReportResponse,
)
from app.modules.analytics.service import (
    generate_store_reports,
    get_barista_queue,
    get_combined_dashboard_overview,
    get_inventory_dashboard_stats,
)
from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


def verify_manager_or_owner(user):
    roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]
    if not ({"owner", "manager"} & set(roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Owners and Managers can access detailed reports.",
        )


@router.get("/overview", response_model=CombinedDashboardResponse)
def get_dashboard_overview(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    branch_id: int | None = Query(default=None),
    role: str | None = Query(default=None),
) -> CombinedDashboardResponse:
    return get_combined_dashboard_overview(
        database,
        authentication.user,
        branch_id=branch_id,
        role=role,
    )


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


@router.get("/reports", response_model=StoreReportResponse)
def get_store_reports(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    period: str = Query(default="today", description="today, this_week, this_month, all_time"),
) -> StoreReportResponse:
    verify_manager_or_owner(authentication.user)
    return generate_store_reports(database, period=period)
