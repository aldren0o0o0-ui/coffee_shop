from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    identifier: str = Field(
        min_length=1,
        max_length=100,
    )
    password: str = Field(
        min_length=1,
        max_length=128,
    )


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_name: str
    description: str | None


class CurrentUserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    roles: list[RoleResponse]


class MessageResponse(BaseModel):
    message: str