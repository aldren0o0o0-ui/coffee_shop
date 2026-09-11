from app.api.routes.health import router as health_router
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import router as team_router

__all__ = [
    "auth_router",
    "health_router",
    "team_router",
]