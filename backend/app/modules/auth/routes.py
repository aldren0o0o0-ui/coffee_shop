from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    status,
)

from app.core.config import settings
from app.modules.auth.dependencies import (
    CurrentAuthenticationDependency,
)
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    MessageResponse,
)
from app.modules.auth.service import (
    IncorrectCurrentPasswordError,
    SamePasswordError,
    authenticate_user,
    change_user_password,
    create_session,
    revoke_session,
    serialize_current_user,
)
from app.shared.dependencies import DatabaseDependency

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


@router.post(
    "/change-password",
    response_model=CurrentUserResponse,
)
def change_password(
    data: ChangePasswordRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CurrentUserResponse:
    try:
        updated_user = change_user_password(
            database=database,
            user=authentication.user,
            current_password=data.current_password,
            new_password=data.new_password,
        )
    except IncorrectCurrentPasswordError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your current password was incorrect. Please try again.",
        ) from error
    except SamePasswordError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your new password cannot be the same as your current password.",
        ) from error

    return serialize_current_user(updated_user)
