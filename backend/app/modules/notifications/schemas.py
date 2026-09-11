from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SystemAlertResponse(BaseModel):
    alert_id: int
    branch_id: int | None = None
    alert_type: str
    severity: str
    title: str
    message: str
    is_resolved: bool
    resolved_by_user_id: int | None = None
    resolved_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertPreferenceResponse(BaseModel):
    user_id: int
    email_alerts: bool
    stock_alerts: bool
    financial_alerts: bool
    min_severity: str

    model_config = ConfigDict(from_attributes=True)


class AlertPreferenceUpdate(BaseModel):
    email_alerts: bool | None = None
    stock_alerts: bool | None = None
    financial_alerts: bool | None = None
    min_severity: str | None = Field(default=None, pattern="^(info|warning|critical)$")


class EvaluationSummaryResponse(BaseModel):
    alerts_evaluated: int
    new_alerts_created: int
    timestamp: datetime
