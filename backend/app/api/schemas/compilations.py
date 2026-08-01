import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.api.schemas.queries import ComplexityResponse
from app.domain.query_model.ast import UniversalQuery


class CompilationRequest(BaseModel):
    document: UniversalQuery
    mode: Literal["definition", "preview"] = "definition"
    preview_values: dict[str, Any] = Field(default_factory=dict)


class ParameterMetadataResponse(BaseModel):
    source: str
    data_type: str
    sensitive: bool
    parameter_id: str | None
    has_value: bool


class CompilationMessageResponse(BaseModel):
    code: str
    message: str


class CompilationResponse(BaseModel):
    id: uuid.UUID | None = None
    success: bool
    engine: str
    provider: str
    server_version: str | None
    dialect: str
    compiler_version: str
    sql: str
    parameters: dict[str, ParameterMetadataResponse]
    warnings: list[CompilationMessageResponse]
    errors: list[CompilationMessageResponse]
    capabilities_used: list[str]
    referenced_entities: list[uuid.UUID]
    referenced_fields: list[uuid.UUID]
    referenced_relationships: list[uuid.UUID]
    query_fingerprint: str
    compilation_fingerprint: str
    complexity: ComplexityResponse
    executed: bool = False


class CompilerCapabilitiesResponse(BaseModel):
    connection_id: uuid.UUID
    engine: str
    provider: str
    server_version: str | None
    compiler_version: str
    capabilities: dict[str, bool]
    supported_features: list[str]
    warnings: list[CompilationMessageResponse]


class CompilationHistoryItem(BaseModel):
    id: uuid.UUID
    saved_query_id: uuid.UUID | None
    query_revision: int | None
    compilation_fingerprint: str
    compiler_version: str
    engine: str
    provider: str
    server_version: str | None
    status: str
    duration_ms: int
    compiled_at: datetime


class CompilationHistoryResponse(BaseModel):
    items: list[CompilationHistoryItem]
