from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentPrincipal
from app.api.schemas.dashboard import DashboardSummaryResponse
from app.application.dashboard import DashboardService
from app.db.session import get_db_session
from app.infrastructure.repositories.dashboard import DashboardRepository

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    principal: CurrentPrincipal,
) -> DashboardSummaryResponse:
    summary = await DashboardService(DashboardRepository(session)).summary(principal)
    return DashboardSummaryResponse(
        generated_at=summary.generated_at,
        execution_period_started_at=summary.execution_period_started_at,
        connections={
            "available": summary.connections.available,
            "total": summary.connections.total,
            "connected": summary.connections.secondary_count,
            "items": summary.connections.items,
        },
        queries={
            "available": summary.queries.available,
            "total": summary.queries.total,
            "items": summary.queries.items,
        },
        executions={
            "available": summary.executions.available,
            "last_24_hours": summary.executions.total,
            "items": summary.executions.items,
        },
        reports={
            "available": summary.reports.available,
            "total": summary.reports.total,
            "published": summary.reports.secondary_count,
            "items": summary.reports.items,
        },
    )
