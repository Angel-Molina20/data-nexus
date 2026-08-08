import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.schemas.executions import ExecutionColumnResponse, ExecutionResponse
from app.domain.reports.configuration import ReportConfiguration


class ReportCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    query_id: uuid.UUID
    query_revision: int = Field(ge=1)
    configuration: ReportConfiguration


class ReportUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    query_revision: int | None = Field(default=None, ge=1)
    configuration: ReportConfiguration | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    query_id: uuid.UUID
    query_revision: int
    connection_id: uuid.UUID
    status: Literal["draft", "published", "archived"]
    title: str
    subtitle: str | None
    configuration: ReportConfiguration
    configuration_version: int
    created_by: uuid.UUID
    published_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    compatible: bool
    warnings: list[str]


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int


class ReportRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parameters: dict[str, Any] = Field(default_factory=dict)
    page: int = Field(default=1, ge=1)
    page_size: int | None = Field(default=None, ge=1)


class ReportPreviewResponse(BaseModel):
    report: ReportResponse
    execution: ExecutionResponse
    columns: list[ExecutionColumnResponse]
    rows: list[dict[str, Any]]
    warnings: list[str]


class ReportExportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file_name: str | None = Field(default=None, max_length=160)


class ReportExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format: Literal["csv", "xlsx", "pdf"]
    parameters: dict[str, Any] = Field(default_factory=dict)
    options: ReportExportOptions = Field(default_factory=ReportExportOptions)


class ReportExportResponse(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    query_id: uuid.UUID
    query_revision: int
    execution_id: uuid.UUID | None
    requested_by: uuid.UUID
    format: Literal["csv", "xlsx", "pdf"]
    status: Literal["pending", "processing", "completed", "failed", "cancelled", "expired"]
    file_name: str
    content_type: str | None
    row_count: int
    file_size: int | None
    started_at: datetime
    finished_at: datetime | None
    expires_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    download_url: str | None


class ReportExportListResponse(BaseModel):
    items: list[ReportExportResponse]
    total: int
    page: int
    page_size: int


class CleanupResponse(BaseModel):
    expired: int
    files_deleted: int
