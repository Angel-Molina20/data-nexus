import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.domain.connections.models import ConnectionStatus, Engine, Provider


class ConnectionInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    engine: Literal["mysql"] = "mysql"
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=3306, ge=1, le=65535)
    database_name: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    ssl_enabled: bool = False
    configuration: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name", "host", "database_name", "username")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("El valor no puede estar vacío.")
        return value


class ConnectionTestRequest(ConnectionInput):
    password: SecretStr = Field(min_length=1)


class ConnectionCreateRequest(ConnectionTestRequest):
    pass


class ConnectionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    host: str | None = Field(default=None, min_length=1, max_length=255)
    port: int | None = Field(default=None, ge=1, le=65535)
    database_name: str | None = Field(default=None, min_length=1, max_length=128)
    username: str | None = Field(default=None, min_length=1, max_length=128)
    password: SecretStr | None = None
    ssl_enabled: bool | None = None
    configuration: dict[str, Any] | None = None

    @field_validator("name", "host", "database_name", "username")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("El valor no puede estar vacío.")
        return value


class ServerVersionResponse(BaseModel):
    major: int
    minor: int
    patch: int


class CapabilitiesResponse(BaseModel):
    supports_subqueries: bool
    supports_derived_tables: bool
    supports_joins: bool
    supports_grouping: bool
    supports_union: bool
    supports_cte: bool
    supports_recursive_cte: bool
    supports_window_functions: bool
    supports_json_type: bool
    supports_json_table: bool
    supports_explain_json: bool
    supports_explain_tree: bool
    supports_explain_analyze: bool


class ServerResponse(BaseModel):
    engine: Engine
    provider: Provider
    raw_version: str
    version: ServerVersionResponse
    version_comment: str | None
    sql_mode: str | None
    character_set: str | None
    collation: str | None
    timezone: str | None
    current_database: str | None


class ConnectionTestResponse(BaseModel):
    success: Literal[True] = True
    server: ServerResponse
    capabilities: CapabilitiesResponse
    warnings: list[str] = Field(default_factory=list)


class ConnectionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    engine: Engine
    provider: Provider
    host: str
    port: int
    database_name: str
    status: ConnectionStatus
    raw_version: str | None
    last_tested_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConnectionDetailResponse(ConnectionSummaryResponse):
    username: str
    ssl_enabled: bool
    configuration: dict[str, Any]
    version: ServerVersionResponse | None
    version_comment: str | None
    sql_mode: str | None
    character_set: str | None
    collation: str | None
    timezone: str | None
    capabilities: CapabilitiesResponse
    last_error_code: str | None
    last_error_message: str | None


class ConnectionListResponse(BaseModel):
    items: list[ConnectionSummaryResponse]
    total: int
    page: int
    page_size: int


class PublicErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, object] | None = None
