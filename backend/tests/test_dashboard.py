import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.auth import SessionPrincipal
from app.application.dashboard import (
    DashboardService,
    RecentConnection,
    RecentExecution,
    RecentQuery,
    RecentReport,
)
from app.db.models.auth import User, UserSession
from app.main import app


class FakeDashboardDataSource:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.user_ids: list[uuid.UUID] = []

    async def connections(
        self, user_id: uuid.UUID, *, is_superuser: bool, limit: int
    ) -> tuple[int, int, list[RecentConnection]]:
        self.calls.append("connections")
        self.user_ids.append(user_id)
        return (
            1,
            1,
            [
                RecentConnection(
                    uuid.uuid4(),
                    "Data warehouse",
                    "mysql",
                    "mysql",
                    "8.4.10",
                    "connected",
                    datetime.now(UTC),
                )
            ],
        )

    async def queries(self, user_id: uuid.UUID, *, limit: int) -> tuple[int, list[RecentQuery]]:
        self.calls.append("queries")
        self.user_ids.append(user_id)
        return 0, []

    async def executions(
        self, user_id: uuid.UUID, *, started_from: datetime, limit: int
    ) -> tuple[int, list[RecentExecution]]:
        self.calls.append("executions")
        self.user_ids.append(user_id)
        return 0, []

    async def reports(
        self, user_id: uuid.UUID, *, limit: int
    ) -> tuple[int, int, list[RecentReport]]:
        self.calls.append("reports")
        self.user_ids.append(user_id)
        return 0, 0, []


def principal_with_permissions(*permissions: str) -> SessionPrincipal:
    user = cast(
        User,
        SimpleNamespace(id=uuid.uuid4(), is_superuser=False),
    )
    session = cast(UserSession, SimpleNamespace())
    return SessionPrincipal(user, session, [], set(permissions))


@pytest.mark.asyncio
async def test_dashboard_only_loads_sections_allowed_by_permissions() -> None:
    data_source = FakeDashboardDataSource()
    summary = await DashboardService(data_source).summary(
        principal_with_permissions("connections.read")
    )

    assert data_source.calls == ["connections"]
    assert summary.connections.available is True
    assert summary.connections.total == 1
    assert summary.queries.available is False
    assert summary.executions.available is False
    assert summary.reports.available is False


@pytest.mark.asyncio
async def test_dashboard_empty_sections_are_real_zeroes() -> None:
    data_source = FakeDashboardDataSource()
    summary = await DashboardService(data_source).summary(
        principal_with_permissions("queries.read", "queries.execute", "reports.read")
    )

    assert data_source.calls == ["queries", "executions", "reports"]
    assert summary.queries.total == 0
    assert summary.executions.total == 0
    assert summary.reports.total == 0
    assert summary.execution_period_started_at < summary.generated_at


@pytest.mark.asyncio
async def test_dashboard_scopes_every_section_to_the_authenticated_user() -> None:
    data_source = FakeDashboardDataSource()
    principal = principal_with_permissions(
        "connections.read",
        "queries.read",
        "queries.execute",
        "reports.read",
    )

    await DashboardService(data_source).summary(principal)

    assert data_source.user_ids == [principal.user.id] * 4


@pytest.mark.asyncio
async def test_dashboard_endpoint_requires_authentication() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard/summary")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.asyncio
async def test_dashboard_endpoint_returns_bounded_real_summary(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/api/v1/dashboard/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["connections"]["available"] is True
    assert payload["queries"]["available"] is True
    assert payload["executions"]["available"] is True
    assert payload["reports"]["available"] is True
    assert len(payload["connections"]["items"]) <= DashboardService.RECENT_LIMIT
    assert len(payload["queries"]["items"]) <= DashboardService.RECENT_LIMIT
    assert len(payload["executions"]["items"]) <= DashboardService.RECENT_LIMIT
    assert len(payload["reports"]["items"]) <= DashboardService.RECENT_LIMIT
