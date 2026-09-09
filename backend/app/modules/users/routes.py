from fastapi import (
    APIRouter,
    HTTPException,
    status,
)

from app.modules.auth.dependencies import (
    OwnerAuthenticationDependency,
)
from app.modules.users.schemas import (
    TeamMemberCreate,
    TeamMemberCreatedResponse,
    TeamMemberResponse,
)
from app.modules.users.service import (
    DuplicateTeamMemberError,
    StaffRoleUnavailableError,
    TeamMemberDatabaseError,
    create_team_member,
    list_team_members,
    serialize_team_member,
)
from app.shared.dependencies import (
    DatabaseDependency,
)

router = APIRouter(
    prefix="/team-members",
    tags=["Team"],
)


@router.get(
    "",
    response_model=list[TeamMemberResponse],
)
def get_team_members(
    database: DatabaseDependency,
    _authentication: OwnerAuthenticationDependency,
) -> list[TeamMemberResponse]:
    users = list_team_members(database)

    return [
        serialize_team_member(user)
        for user in users
    ]


@router.post(
    "",
    response_model=TeamMemberCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_team_member(
    data: TeamMemberCreate,
    database: DatabaseDependency,
    _authentication: OwnerAuthenticationDependency,
) -> TeamMemberCreatedResponse:
    try:
        user, temporary_password = create_team_member(
            database,
            data,
        )
    except DuplicateTeamMemberError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A team member already uses that "
                "username or email address."
            ),
        ) from error
    except TeamMemberDatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "The account could not be created. "
                "Please try again or contact support."
            ),
        ) from error
    except StaffRoleUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="That job responsibility is unavailable.",
        ) from error

    serialized_user = serialize_team_member(user)

    return TeamMemberCreatedResponse(
        **serialized_user.model_dump(),
        temporary_password=temporary_password,
    )
