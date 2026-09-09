from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password_safely,
)
from app.modules.auth.models import AuthSession
from app.modules.auth.schemas import CurrentUserResponse, RoleResponse
from app.modules.users.models import User, UserRole


class IncorrectCurrentPasswordError(Exception):
    """Raised when the provided current password is wrong."""
    pass


class SamePasswordError(Exception):
    """Raised when the new password is the same as the old password."""
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def find_user_for_login(
    database: Session,
    identifier: str,
) -> User | None:
    normalized_identifier = identifier.strip().lower()

    statement = (
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
        )
        .where(
            or_(
                func.lower(User.username) == normalized_identifier,
                func.lower(User.email) == normalized_identifier,
            )
        )
        .limit(1)
    )

    return database.scalar(statement)


def authenticate_user(
    database: Session,
    identifier: str,
    password: str,
) -> User | None:
    user = find_user_for_login(database, identifier)

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password_safely(
        password,
        user.password_hash,
    ):
        return None

    return user


def create_session(
    database: Session,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[AuthSession, str]:
    raw_token = generate_session_token()
    now = utc_now()

    auth_session = AuthSession(
        user_id=user.user_id,
        token_hash=hash_session_token(raw_token),
        expires_at=now
        + timedelta(hours=settings.session_lifetime_hours),
        last_seen_at=now,
        ip_address=(
            ip_address[:45]
            if ip_address
            else None
        ),
        user_agent=(
            user_agent[:255]
            if user_agent
            else None
        ),
    )

    database.add(auth_session)

    user.last_login_at = now

    database.commit()
    database.refresh(auth_session)

    return auth_session, raw_token


def revoke_session(
    database: Session,
    auth_session: AuthSession,
) -> None:
    if auth_session.revoked_at is None:
        auth_session.revoked_at = utc_now()
        database.commit()


def serialize_current_user(
    user: User,
) -> CurrentUserResponse:
    roles = [
        RoleResponse(
            role_name=user_role.role.role_name,
            description=user_role.role.description,
        )
        for user_role in user.user_roles
        if (
            user_role.is_active
            and user_role.role.is_active
        )
    ]

    roles.sort(key=lambda role: role.role_name.lower())

    return CurrentUserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        must_change_password=user.must_change_password,
        roles=roles,
    )


def change_user_password(
    database: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> User:
    if not verify_password_safely(
        current_password,
        user.password_hash,
    ):
        raise IncorrectCurrentPasswordError("Current password is incorrect.")

    if verify_password_safely(
        new_password,
        user.password_hash,
    ):
        raise SamePasswordError(
            "Your new password cannot be the same as your current password."
        )

    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    database.commit()
    database.refresh(user)

    return user
