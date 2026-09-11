from fastapi import APIRouter, HTTPException, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.costing.schemas import CostingSummary
from app.modules.costing.service import get_menu_costing
from app.shared.dependencies import DatabaseDependency

router = APIRouter(prefix="/costing", tags=["Recipe Costing"])


@router.get("/menu", response_model=CostingSummary)
def get_current_menu_costing(authentication: CurrentAuthenticationDependency, database: DatabaseDependency) -> CostingSummary:
    roles = {role.role.role_name.lower() for role in authentication.user.user_roles if role.is_active and role.role.is_active}
    if not roles.intersection({"owner", "manager"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Store Owners and Managers can view costing.")
    return get_menu_costing(database)
