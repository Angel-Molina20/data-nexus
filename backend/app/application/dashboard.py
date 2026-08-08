import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.application.auth import SessionPrincipal


@dataclass(frozen=True)
class RecentConnection:
    id: uuid.UUID
    name: str
    engine: str
    provider: str
    raw_version: str | None
    status: str
    updated_at: datetime


@dataclass(frozen=True)
class RecentQuery:
    id: uuid.UUID
    name: str
    connection_id: uuid.UUID
    status: str
    validation_status: str
    updated_at: datetime


@dataclass(frozen=True)
class RecentExecution:
    id: uuid.UUID
    query_id: uuid.UUID | None
    query_name: str | None
    status: str
    duration_ms: int | None
    row_count: int
    started_at: datetime


@dataclass(frozen=True)
class RecentReport:
    id: uuid.UUID
    name: str
    query_id: uuid.UUID
    query_name: str | None
    status: str
    updated_at: datetime


@dataclass(frozen=True)
class DashboardSection:
    available: bool
    total: int | None = None
    secondary_count: int | None = None
    items: list[object] = field(default_factory=list)


@dataclass(frozen=True)
class DashboardSummary:
    generated_at: datetime
    execution_period_started_at: datetime
    connections: DashboardSection
    queries: DashboardSection
    executions: DashboardSection
    reports: DashboardSection


class DashboardDataSource(Protocol):
    async def connections(
        self, user_id: uuid.UUID, *, is_superuser: bool, limit: int
    ) -> tuple[int, int, list[RecentConnection]]: ...

    async def queries(self, user_id: uuid.UUID, *, limit: int) -> tuple[int, list[RecentQuery]]: ...

    async def executions(
        self, user_id: uuid.UUID, *, started_from: datetime, limit: int
    ) -> tuple[int, list[RecentExecution]]: ...

    async def reports(
        self, user_id: uuid.UUID, *, limit: int
    ) -> tuple[int, int, list[RecentReport]]: ...


class DashboardService:
    RECENT_LIMIT = 5
    EXECUTION_PERIOD = timedelta(hours=24)

    def __init__(self, data_source: DashboardDataSource) -> None:
        self.data_source = data_source

    async def summary(self, principal: SessionPrincipal) -> DashboardSummary:
        now = datetime.now(UTC)
        period_started_at = now - self.EXECUTION_PERIOD
        can_read_connections = self._can(principal, "connections.read")
        can_read_queries = self._can(principal, "queries.read")
        can_read_executions = self._can(principal, "queries.execute")
        can_read_reports = self._can(principal, "reports.read")

        connection_section = DashboardSection(available=False)
        if can_read_connections:
            total, connected, connection_items = await self.data_source.connections(
                principal.user.id,
                is_superuser=principal.user.is_superuser,
                limit=self.RECENT_LIMIT,
            )
            connection_section = DashboardSection(True, total, connected, list(connection_items))

        query_section = DashboardSection(available=False)
        if can_read_queries:
            total, query_items = await self.data_source.queries(
                principal.user.id, limit=self.RECENT_LIMIT
            )
            query_section = DashboardSection(True, total, items=list(query_items))

        execution_section = DashboardSection(available=False)
        if can_read_executions:
            total, execution_items = await self.data_source.executions(
                principal.user.id,
                started_from=period_started_at,
                limit=self.RECENT_LIMIT,
            )
            execution_section = DashboardSection(True, total, items=list(execution_items))

        report_section = DashboardSection(available=False)
        if can_read_reports:
            total, published, report_items = await self.data_source.reports(
                principal.user.id, limit=self.RECENT_LIMIT
            )
            report_section = DashboardSection(True, total, published, list(report_items))

        return DashboardSummary(
            generated_at=now,
            execution_period_started_at=period_started_at,
            connections=connection_section,
            queries=query_section,
            executions=execution_section,
            reports=report_section,
        )

    @staticmethod
    def _can(principal: SessionPrincipal, permission: str) -> bool:
        return principal.user.is_superuser or permission in principal.permissions
