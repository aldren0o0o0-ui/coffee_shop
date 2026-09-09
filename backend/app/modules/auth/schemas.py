from pydantic import BaseModel, ConfigDict, Field, model_validator


class LoginRequest(BaseModel):
    identifier: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Username or email address",
    )
    password: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Your existing account password.",
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="A new secure password of at least 8 characters.",
    )
    confirm_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Confirmation of the new password.",
    )

    @model_validator(mode="after")
    def verify_password_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation password do not match.")
        return self


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_name: str
    description: str | None = None


class CurrentUserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    must_change_password: bool
    roles: list[RoleResponse]


class MessageResponse(BaseModel):
    message: str
