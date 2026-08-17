from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import hash_session_token
from app.database.session import get_db
from app.models.auth_session import AuthSession
from app.models.user import User, UserRole


DatabaseDependency = Annotated[
    Session,
    Depends(get_db),
]


@dataclass
class CurrentAuthentication:
    user: User
    session: AuthSession


def unauthorized_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
    )


def get_current_authentication(
    database: DatabaseDependency,
    session_token: Annotated[
        str | None,
        Cookie(alias=settings.session_cookie_name),
    ] = None,
) -> CurrentAuthentication:
    if not session_token:
        raise unauthorized_exception()

    now = datetime.now(timezone.utc)

    statement = (
        select(AuthSession)
        .join(AuthSession.user)
        .options(
            selectinload(AuthSession.user)
            .selectinload(User.user_roles)
            .selectinload(UserRole.role)
        )
        .where(
            AuthSession.token_hash
            == hash_session_token(session_token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
            User.is_active.is_(True),
        )
        .limit(1)
    )

    auth_session = database.scalar(statement)

    if auth_session is None:
        raise unauthorized_exception()

    # Avoid writing to PostgreSQL on every request.
    if (
        auth_session.last_seen_at is None
        or auth_session.last_seen_at
        < now - timedelta(minutes=5)
    ):
        auth_session.last_seen_at = now
        database.commit()

    return CurrentAuthentication(
        user=auth_session.user,
        session=auth_session,
    )


CurrentAuthenticationDependency = Annotated[
    CurrentAuthentication,
    Depends(get_current_authentication),
]


def require_owner(
    authentication: CurrentAuthenticationDependency,
) -> CurrentAuthentication:
    has_owner_role = any(
        user_role.is_active
        and user_role.role.is_active
        and user_role.role.role_name.lower() == "owner"
        for user_role in authentication.user.user_roles
    )

    if not has_owner_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return authentication


OwnerAuthenticationDependency = Annotated[
    CurrentAuthentication,
    Depends(require_owner),
]