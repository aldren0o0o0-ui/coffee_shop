from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    status,
)

from app.api.dependencies import (
    CurrentAuthenticationDependency,
    DatabaseDependency,
)
from app.core.config import settings
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    MessageResponse,
)
from app.services.auth import (
    authenticate_user,
    create_session,
    revoke_session,
    serialize_current_user,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=CurrentUserResponse,
)
def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    database: DatabaseDependency,
) -> CurrentUserResponse:
    user = authenticate_user(
        database,
        credentials.identifier,
        credentials.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    _, raw_token = create_session(
        database=database,
        user=user,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get("user-agent"),
    )

    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_lifetime_hours * 60 * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/api/v1",
    )

    return serialize_current_user(user)


@router.post(
    "/logout",
    response_model=MessageResponse,
)
def logout(
    response: Response,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MessageResponse:
    revoke_session(
        database,
        authentication.session,
    )

    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/api/v1",
    )

    return MessageResponse(
        message="You have been signed out.",
    )


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def current_user(
    authentication: CurrentAuthenticationDependency,
) -> CurrentUserResponse:
    return serialize_current_user(
        authentication.user,
    )