from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import (
    generate_temporary_password,
    hash_password,
)
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.team import (
    StaffRole,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberRoleResponse,
)


ROLE_DATABASE_NAMES = {
    StaffRole.MANAGER: "Manager",
    StaffRole.CASHIER: "Cashier",
    StaffRole.BARISTA: "Barista",
    StaffRole.INVENTORY_STAFF: "Inventory Staff",
}


class DuplicateTeamMemberError(Exception):
    pass


class StaffRoleUnavailableError(Exception):
    pass


def identity_exists(
    database: Session,
    username: str,
    email: str,
) -> bool:
    statement = (
        select(User.user_id)
        .where(
            or_(
                func.lower(User.username)
                == username.lower(),
                func.lower(User.email)
                == email.lower(),
            )
        )
        .limit(1)
    )

    return database.scalar(statement) is not None


def get_staff_role(
    database: Session,
    role: StaffRole,
) -> Role | None:
    database_name = ROLE_DATABASE_NAMES[role]

    statement = (
        select(Role)
        .where(
            func.lower(Role.role_name)
            == database_name.lower(),
            Role.is_active.is_(True),
        )
        .limit(1)
    )

    return database.scalar(statement)


def serialize_team_member(
    user: User,
) -> TeamMemberResponse:
    roles = [
        TeamMemberRoleResponse(
            role_name=user_role.role.role_name,
            description=user_role.role.description,
        )
        for user_role in user.user_roles
        if user_role.is_active
    ]

    roles.sort(
        key=lambda role: role.role_name.lower(),
    )

    return TeamMemberResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=roles,
    )


def create_team_member(
    database: Session,
    data: TeamMemberCreate,
) -> tuple[User, str]:
    normalized_username = data.username.strip().lower()
    normalized_email = str(data.email).strip().lower()

    if identity_exists(
        database,
        normalized_username,
        normalized_email,
    ):
        raise DuplicateTeamMemberError

    role = get_staff_role(
        database,
        data.role,
    )

    if role is None:
        raise StaffRoleUnavailableError

    temporary_password = generate_temporary_password()

    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(
            temporary_password,
        ),
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        phone_number=data.phone_number,
        is_active=True,
        must_change_password=True,
    )

    try:
        database.add(user)
        database.flush()

        database.add(
            UserRole(
                user_id=user.user_id,
                role_id=role.role_id,
                is_active=True,
            )
        )

        database.commit()

    except IntegrityError as error:
        database.rollback()

        raise DuplicateTeamMemberError from error

    statement = (
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
        )
        .where(User.user_id == user.user_id)
    )

    created_user = database.scalars(
        statement
    ).one()

    return created_user, temporary_password

def list_team_members(
    database: Session,
) -> list[User]:
    statement = (
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
        )
        .order_by(
            User.is_active.desc(),
            User.first_name,
            User.last_name,
        )
    )

    return list(database.scalars(statement).unique())