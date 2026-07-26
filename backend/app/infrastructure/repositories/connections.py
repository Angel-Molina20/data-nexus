import uuid

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.database_connection import DatabaseConnection


class DatabaseConnectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, connection: DatabaseConnection) -> DatabaseConnection:
        self.session.add(connection)
        await self.session.flush()
        await self.session.refresh(connection)
        return connection

    async def get(self, connection_id: uuid.UUID) -> DatabaseConnection | None:
        return await self.session.get(DatabaseConnection, connection_id)

    async def name_exists(self, name: str, exclude_id: uuid.UUID | None = None) -> bool:
        query = select(DatabaseConnection.id).where(
            func.lower(DatabaseConnection.name) == name.casefold()
        )
        if exclude_id is not None:
            query = query.where(DatabaseConnection.id != exclude_id)
        return (await self.session.execute(query.limit(1))).scalar_one_or_none() is not None

    async def list(
        self, *, search: str | None, status: str | None, page: int, page_size: int
    ) -> tuple[list[DatabaseConnection], int]:
        filters: list[ColumnElement[bool]] = []
        if search:
            filters.append(DatabaseConnection.name.ilike(f"%{search}%"))
        if status:
            filters.append(DatabaseConnection.status == status)
        query = select(DatabaseConnection).where(*filters)
        count_query = select(func.count()).select_from(DatabaseConnection).where(*filters)
        total = int((await self.session.execute(count_query)).scalar_one())
        items = list(
            (
                await self.session.scalars(
                    query.order_by(DatabaseConnection.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def delete(self, connection: DatabaseConnection) -> None:
        await self.session.delete(connection)
        await self.session.flush()
