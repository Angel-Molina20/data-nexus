import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DashboardResponseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RecentConnectionResponse(DashboardResponseModel):
    id: uuid.UUID
    name: str
    engine: str
    provider: str
    raw_version: str | None
    status: str
    updated_at: datetime


class RecentQueryResponse(DashboardResponseModel):
    id: uuid.UUID
    name: str
    connection_id: uuid.UUID
    status: str
    validation_status: str
    updated_at: datetime


class RecentExecutionResponse(DashboardResponseModel):
    id: uuid.UUID
    query_id: uuid.UUID | None
    query_name: str | None
    status: str
    duration_ms: int | None
    row_count: int
    started_at: datetime


class RecentReportResponse(DashboardResponseModel):
    id: uuid.UUID
    name: str
    query_id: uuid.UUID
    query_name: str | None
    status: str
    updated_at: datetime


class ConnectionDashboardSection(BaseModel):
    available: bool
    total: int | None
    connected: int | None
    items: list[RecentConnectionResponse]


class QueryDashboardSection(BaseModel):
    available: bool
    total: int | None
    items: list[RecentQueryResponse]


class ExecutionDashboardSection(BaseModel):
    available: bool
    last_24_hours: int | None
    items: list[RecentExecutionResponse]


class ReportDashboardSection(BaseModel):
    available: bool
    total: int | None
    published: int | None
    items: list[RecentReportResponse]


class DashboardSummaryResponse(BaseModel):
    generated_at: datetime
    execution_period_started_at: datetime
    connections: ConnectionDashboardSection
    queries: QueryDashboardSection
    executions: ExecutionDashboardSection
    reports: ReportDashboardSection
