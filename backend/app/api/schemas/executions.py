import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.query_model.ast import UniversalQuery


class ExecutionPaginationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1)
    page_size: int | None = Field(default=None, ge=1)


class ExecutionOptionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    include_total_count: bool = False
    include_compiled_sql: bool = False


class QueryExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    connection_id: uuid.UUID
    execution_id: uuid.UUID | None = None
    query_id: uuid.UUID | None = None
    query_revision: int | None = Field(default=None, ge=1)
    ast: UniversalQuery
    parameters: dict[str, Any] = Field(default_factory=dict)
    pagination: ExecutionPaginationRequest = Field(default_factory=ExecutionPaginationRequest)
    options: ExecutionOptionsRequest = Field(default_factory=ExecutionOptionsRequest)


class ExecutionColumnResponse(BaseModel):
    key: str
    label: str
    data_type: str
    nullable: bool
    source: str | None = None
    format: str | None = None


class ExecutionMetadataResponse(BaseModel):
    database_engine: str
    database_version: str | None
    compiled_sql: str | None = None


class ExecutionResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    query_id: uuid.UUID | None
    query_revision: int | None
    status: Literal["pending", "running", "completed", "failed", "cancelled", "timed_out"]
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    row_count: int
    returned_row_count: int
    truncated: bool
    page: int
    page_size: int
    total_rows: int | None
    total_pages: int | None
    error_code: str | None = None
    error_message: str | None = None


class QueryExecutionResultResponse(BaseModel):
    execution: ExecutionResponse
    columns: list[ExecutionColumnResponse]
    rows: list[dict[str, Any]]
    warnings: list[str]
    metadata: ExecutionMetadataResponse


class ExecutionHistoryResponse(BaseModel):
    items: list[ExecutionResponse]
    page: int
    page_size: int


class CancelExecutionResponse(BaseModel):
    execution: ExecutionResponse
    cancellation_supported: bool
