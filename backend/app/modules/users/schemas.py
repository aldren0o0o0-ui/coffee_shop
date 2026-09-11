from enum import Enum

from pydantic import BaseModel, Field


class StaffRole(str, Enum):
    MANAGER = "manager"
    CASHIER = "cashier"
    BARISTA = "barista"
    INVENTORY_STAFF = "inventory_staff"


class TeamMemberRoleResponse(BaseModel):
    role_name: str
    description: str | None = None


class TeamMemberResponse(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    phone_number: str | None = None
    is_active: bool
    must_change_password: bool
    roles: list[TeamMemberRoleResponse]


class TeamMemberCreatedResponse(TeamMemberResponse):
    temporary_password: str


class TeamMemberCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_.-]+$",
        description=(
            "Unique staff username (letters, numbers, "
            "underscores, hyphens, and dots)."
        ),
    )

    email: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Unique staff email address.",
    )

    first_name: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    last_name: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    phone_number: str | None = Field(
        None,
        max_length=20,
        description="Optional contact telephone number.",
    )

    role: StaffRole = Field(
        ...,
        description="Primary job responsibility for this staff member.",
    )
