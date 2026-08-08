import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dashboard import (
    RecentConnection,
    RecentExecution,
    RecentQuery,
    RecentReport,
)
from app.db.models.auth import ConnectionAccess
from app.db.models.database_connection import DatabaseConnection
from app.db.models.execution import QueryExecution
from app.db.models.query import SavedQuery
from app.db.models.report import Report


class DashboardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def connections(
        self, user_id: uuid.UUID, *, is_superuser: bool, limit: int
    ) -> tuple[int, int, list[RecentConnection]]:
        statement = select(DatabaseConnection)
        if not is_superuser:
            statement = statement.join(ConnectionAccess).where(ConnectionAccess.user_id == user_id)
        total = int(
            await self.session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )
        connected = int(
            await self.session.scalar(
                select(func.count()).select_from(
                    statement.where(DatabaseConnection.status == "connected").subquery()
                )
            )
            or 0
        )
        models = list(
            (
                await self.session.scalars(
                    statement.order_by(DatabaseConnection.updated_at.desc()).limit(limit)
                )
            ).all()
        )
        return (
            total,
            connected,
            [
                RecentConnection(
                    item.id,
                    item.name,
                    item.engine,
                    item.provider,
                    item.raw_version,
                    item.status,
                    item.updated_at,
                )
                for item in models
            ],
        )

    async def queries(self, user_id: uuid.UUID, *, limit: int) -> tuple[int, list[RecentQuery]]:
        base = SavedQuery.owner_user_id == user_id
        total = int(
            await self.session.scalar(select(func.count()).select_from(SavedQuery).where(base)) or 0
        )
        models = list(
            (
                await self.session.scalars(
                    select(SavedQuery)
                    .where(base)
                    .order_by(SavedQuery.updated_at.desc())
                    .limit(limit)
                )
            ).all()
        )
        return total, [
            RecentQuery(
                item.id,
                item.name,
                item.connection_id,
                item.status,
                item.validation_status,
                item.updated_at,
            )
            for item in models
        ]

    async def executions(
        self, user_id: uuid.UUID, *, started_from: datetime, limit: int
    ) -> tuple[int, list[RecentExecution]]:
        base = (
            QueryExecution.user_id == user_id,
            QueryExecution.started_at >= started_from,
        )
        total = int(
            await self.session.scalar(select(func.count()).select_from(QueryExecution).where(*base))
            or 0
        )
        rows = (
            await self.session.execute(
                select(QueryExecution, SavedQuery.name)
                .outerjoin(SavedQuery, SavedQuery.id == QueryExecution.query_id)
                .where(*base)
                .order_by(QueryExecution.started_at.desc())
                .limit(limit)
            )
        ).all()
        return total, [
            RecentExecution(
                execution.id,
                execution.query_id,
                query_name,
                execution.status,
                execution.duration_ms,
                execution.row_count,
                execution.started_at,
            )
            for execution, query_name in rows
        ]

    async def reports(
        self, user_id: uuid.UUID, *, limit: int
    ) -> tuple[int, int, list[RecentReport]]:
        base = (Report.created_by == user_id, Report.status != "archived")
        total = int(
            await self.session.scalar(select(func.count()).select_from(Report).where(*base)) or 0
        )
        published = int(
            await self.session.scalar(
                select(func.count()).select_from(Report).where(*base, Report.status == "published")
            )
            or 0
        )
        rows = (
            await self.session.execute(
                select(Report, SavedQuery.name)
                .outerjoin(SavedQuery, SavedQuery.id == Report.query_id)
                .where(*base)
                .order_by(Report.updated_at.desc())
                .limit(limit)
            )
        ).all()
        return (
            total,
            published,
            [
                RecentReport(
                    report.id,
                    report.name,
                    report.query_id,
                    query_name,
                    report.status,
                    report.updated_at,
                )
                for report, query_name in rows
            ],
        )
