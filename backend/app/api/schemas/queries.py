import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.domain.query_model.ast import UniversalQuery


class QueryIssueResponse(BaseModel):
    code: str
    message: str
    severity: str
    path: str
    node_id: str | None = None
    details: dict[str, str | int | bool] | None = None


class ComplexityResponse(BaseModel):
    score: int
    level: str
    metrics: dict[str, int]


class QueryValidationResponse(BaseModel):
    valid: bool
    errors: list[QueryIssueResponse]
    warnings: list[QueryIssueResponse]
    capabilities_required: list[str]
    referenced_entities: list[uuid.UUID]
    referenced_fields: list[uuid.UUID]
    referenced_relationships: list[uuid.UUID]
    parameters: list[str]
    complexity: ComplexityResponse
    normalized_query: dict[str, Any]
    fingerprint: str


class NormalizeResponse(BaseModel):
    normalized_query: dict[str, Any]
    fingerprint: str


class SavedQueryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    document: UniversalQuery


class SavedQueryUpdateRequest(BaseModel):
    revision: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    document: UniversalQuery | None = None


class SavedQueryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    connection_id: uuid.UUID
    owner_user_id: uuid.UUID
    document: dict[str, Any]
    schema_version: str
    status: str
    validation_status: str
    validation_errors: list[dict[str, Any]]
    validation_warnings: list[dict[str, Any]]
    fingerprint: str | None
    complexity: dict[str, Any] | None
    revision: int
    last_validated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SavedQueryListResponse(BaseModel):
    items: list[SavedQueryResponse]
    total: int
    page: int
    page_size: int
