import uuid
from datetime import datetime
from typing import cast

from sqlalchemy import Select, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.execution import QueryExecution


class QueryExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, model: QueryExecution) -> None:
        self.session.add(model)
        await self.session.flush()

    async def get_for_user(
        self, execution_id: uuid.UUID, user_id: uuid.UUID
    ) -> QueryExecution | None:
        return cast(
            QueryExecution | None,
            await self.session.scalar(
                select(QueryExecution).where(
                    QueryExecution.id == execution_id, QueryExecution.user_id == user_id
                )
            ),
        )

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
        query_id: uuid.UUID | None = None,
        connection_id: uuid.UUID | None = None,
        status: str | None = None,
        started_from: datetime | None = None,
        started_to: datetime | None = None,
    ) -> list[QueryExecution]:
        statement: Select[tuple[QueryExecution]] = select(QueryExecution).where(
            QueryExecution.user_id == user_id
        )
        if query_id:
            statement = statement.where(QueryExecution.query_id == query_id)
        if connection_id:
            statement = statement.where(QueryExecution.connection_id == connection_id)
        if status:
            statement = statement.where(QueryExecution.status == status)
        if started_from:
            statement = statement.where(QueryExecution.started_at >= started_from)
        if started_to:
            statement = statement.where(QueryExecution.started_at <= started_to)
        return list(
            (
                await self.session.scalars(
                    statement.order_by(desc(QueryExecution.started_at)).limit(limit).offset(offset)
                )
            ).all()
        )
