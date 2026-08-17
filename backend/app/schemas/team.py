from enum import Enum

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
)


class StaffRole(str, Enum):
    MANAGER = "manager"
    CASHIER = "cashier"
    BARISTA = "barista"
    INVENTORY_STAFF = "inventory_staff"


class TeamMemberCreate(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=50,
    )
    last_name: str = Field(
        min_length=1,
        max_length=50,
    )
    email: EmailStr
    username: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9._-]+$",
    )
    phone_number: str | None = Field(
        default=None,
        max_length=20,
    )
    role: StaffRole

    @field_validator(
        "first_name",
        "last_name",
        "username",
    )
    @classmethod
    def strip_required_values(
        cls,
        value: str,
    ) -> str:
        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("This field is required.")

        return cleaned_value

    @field_validator("phone_number")
    @classmethod
    def clean_phone_number(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned_value = value.strip()

        return cleaned_value or None


class TeamMemberRoleResponse(BaseModel):
    role_name: str
    description: str | None


class TeamMemberResponse(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    phone_number: str | None
    is_active: bool
    must_change_password: bool
    roles: list[TeamMemberRoleResponse]


class TeamMemberCreatedResponse(TeamMemberResponse):
    temporary_password: str