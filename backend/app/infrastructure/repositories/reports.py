import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.report import Report, ReportExport


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, model: Report) -> None:
        self.session.add(model)
        await self.session.flush()

    async def get(self, report_id: uuid.UUID, user_id: uuid.UUID) -> Report | None:
        result = await self.session.scalars(
            select(Report).where(Report.id == report_id, Report.created_by == user_id)
        )
        return result.one_or_none()

    async def list(
        self,
        user_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        status: str | None = None,
        query_id: uuid.UUID | None = None,
        connection_id: uuid.UUID | None = None,
        search: str | None = None,
        include_archived: bool = False,
    ) -> tuple[list[Report], int]:
        statement: Select[tuple[Report]] = select(Report).where(Report.created_by == user_id)
        if status:
            statement = statement.where(Report.status == status)
        elif not include_archived:
            statement = statement.where(Report.status != "archived")
        if query_id:
            statement = statement.where(Report.query_id == query_id)
        if connection_id:
            statement = statement.where(Report.connection_id == connection_id)
        if search:
            term = f"%{search}%"
            statement = statement.where(or_(Report.name.ilike(term), Report.title.ilike(term)))
        total = int(
            await self.session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )
        items = list(
            (
                await self.session.scalars(
                    statement.order_by(Report.updated_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total


class ReportExportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, model: ReportExport) -> None:
        self.session.add(model)
        await self.session.flush()

    async def get(self, export_id: uuid.UUID, user_id: uuid.UUID) -> ReportExport | None:
        result = await self.session.scalars(
            select(ReportExport).where(
                ReportExport.id == export_id, ReportExport.requested_by == user_id
            )
        )
        return result.one_or_none()

    async def list(
        self,
        user_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        report_id: uuid.UUID | None = None,
        format: str | None = None,
        status: str | None = None,
    ) -> tuple[list[ReportExport], int]:
        statement: Select[tuple[ReportExport]] = select(ReportExport).where(
            ReportExport.requested_by == user_id
        )
        if report_id:
            statement = statement.where(ReportExport.report_id == report_id)
        if format:
            statement = statement.where(ReportExport.format == format)
        if status:
            statement = statement.where(ReportExport.status == status)
        total = int(
            await self.session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )
        items = list(
            (
                await self.session.scalars(
                    statement.order_by(ReportExport.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def active_count(self, user_id: uuid.UUID) -> int:
        return int(
            await self.session.scalar(
                select(func.count())
                .select_from(ReportExport)
                .where(
                    ReportExport.requested_by == user_id,
                    ReportExport.status.in_(["pending", "processing"]),
                )
            )
            or 0
        )

    async def expired(self, now: datetime) -> Sequence[ReportExport]:
        return list(
            (
                await self.session.scalars(
                    select(ReportExport).where(
                        ReportExport.status == "completed", ReportExport.expires_at <= now
                    )
                )
            ).all()
        )
