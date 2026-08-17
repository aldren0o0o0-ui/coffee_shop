from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter(prefix="/health", tags={"Health Check"})

@router.get("/check")
def check_health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "ldrn-api"
    }

@router.get("/db")
def check_health_db(
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "service": "ldrn-api-db"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        ) from exc