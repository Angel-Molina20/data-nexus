import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator

Password = Annotated[str, StringConstraints(min_length=1, max_length=256)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: Password


class ChangePasswordRequest(BaseModel):
    current_password: Password
    new_password: Password
    confirm_password: Password

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Las contraseñas no coinciden")
        return self


class CurrentUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: str
    roles: list[str]
    permissions: list[str]
    must_change_password: bool


class CsrfResponse(BaseModel):
    csrf_token: str


class SessionResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    ip_address: str | None
    current: bool


class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: Name
    password: Password
    role_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    must_change_password: bool = True


class UserUpdateRequest(BaseModel):
    full_name: Name | None = None
    status: Literal["active", "inactive", "locked", "pending"] | None = None


class ResetPasswordRequest(BaseModel):
    password: Password
    must_change_password: bool = True


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: str
    is_superuser: bool
    must_change_password: bool
    failed_login_attempts: int
    locked_until: datetime | None
    last_login_at: datetime | None
    roles: list[str]
    created_at: datetime


class RoleRequest(BaseModel):
    code: Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_-]{1,79}$")]
    name: Name
    description: Annotated[str, StringConstraints(max_length=2000)] | None = None


class RoleResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_system: bool
    permissions: list[str]


class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    resource_type: str


class IdListRequest(BaseModel):
    ids: list[uuid.UUID] = Field(max_length=100)


class AccessRequest(BaseModel):
    access_level: Literal["viewer", "analyst", "manager"]
