from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.notifications import service as notifications_service
from app.modules.notifications.schemas import (
    AlertPreferenceResponse,
    AlertPreferenceUpdate,
    EvaluationSummaryResponse,
    SystemAlertResponse,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications & Alerts"],
)


@router.get(
    "/alerts",
    response_model=list[SystemAlertResponse],
    status_code=status.HTTP_200_OK,
    summary="List operational system alerts",
)
def list_alerts(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    branch_id: int | None = Query(default=None),
    is_resolved: bool | None = Query(default=False),
) -> list[SystemAlertResponse]:
    return notifications_service.list_alerts(database, branch_id=branch_id, is_resolved=is_resolved)


@router.post(
    "/alerts/{alert_id}/resolve",
    response_model=SystemAlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve a system alert (Manager/Owner)",
)
def resolve_alert(
    alert_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> SystemAlertResponse:
    user_roles = [r.role.role_name.lower() for r in authentication.user.user_roles if r.is_active and r.role.is_active]
    if not (set(user_roles) & {"owner", "manager"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and owners can resolve system alerts.",
        )
    return notifications_service.resolve_alert(database, alert_id, authentication.user)


@router.get(
    "/preferences",
    response_model=AlertPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user alert preferences",
)
def get_preferences(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> AlertPreferenceResponse:
    return notifications_service.get_user_preferences(database, authentication.user.user_id)


@router.put(
    "/preferences",
    response_model=AlertPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user alert preferences",
)
def update_preferences(
    payload: AlertPreferenceUpdate,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> AlertPreferenceResponse:
    return notifications_service.update_user_preferences(database, authentication.user.user_id, payload)


@router.post(
    "/evaluate",
    response_model=EvaluationSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger rule evaluation for operational alerts",
)
def trigger_alert_evaluation(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> EvaluationSummaryResponse:
    count = notifications_service.evaluate_system_alerts(database)
    return EvaluationSummaryResponse(
        alerts_evaluated=count,
        new_alerts_created=count,
        timestamp=datetime.now(timezone.utc),
    )
