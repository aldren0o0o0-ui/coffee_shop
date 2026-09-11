from fastapi import APIRouter, HTTPException, status
from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.engagement.schemas import WinBackAudienceRequest, WinBackAudienceResponse
from app.modules.engagement.service import get_win_back_audience
from app.shared.dependencies import DatabaseDependency
router = APIRouter(prefix="/engagement", tags=["Customer Engagement"])
@router.post("/win-back/audience", response_model=WinBackAudienceResponse)
def preview_win_back(payload: WinBackAudienceRequest, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    roles = {r.role.role_name.lower() for r in authentication.user.user_roles if r.is_active and r.role.is_active}
    if not roles.intersection({"owner", "manager"}): raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required.")
    return get_win_back_audience(database, payload.inactive_days)
