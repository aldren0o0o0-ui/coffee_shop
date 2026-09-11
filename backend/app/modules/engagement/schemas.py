from pydantic import BaseModel, Field

class WinBackAudienceResponse(BaseModel):
    inactive_days: int
    eligible_customers: int

class WinBackAudienceRequest(BaseModel):
    inactive_days: int = Field(default=30, ge=7, le=365)
