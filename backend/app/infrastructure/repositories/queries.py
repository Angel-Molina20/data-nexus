import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.query import SavedQuery
from app.db.models.schema import SchemaEntity, SchemaField
from app.db.models.semantic import SemanticEntity, SemanticField


class SavedQueryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, model: SavedQuery) -> SavedQuery:
        self.session.add(model)
        await self.session.flush()
        return model

    async def get(self, query_id: uuid.UUID) -> SavedQuery | None:
        return await self.session.get(SavedQuery, query_id)

    async def list(
        self, owner_id: uuid.UUID, *, page: int, page_size: int
    ) -> tuple[list[SavedQuery], int]:
        base = SavedQuery.owner_user_id == owner_id
        total = int(
            (await self.session.scalar(select(func.count()).select_from(SavedQuery).where(base)))
            or 0
        )
        items = list(
            (
                await self.session.scalars(
                    select(SavedQuery)
                    .where(base)
                    .order_by(SavedQuery.updated_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def catalog(
        self, connection_id: uuid.UUID
    ) -> tuple[
        dict[uuid.UUID, SchemaEntity],
        dict[uuid.UUID, SchemaField],
        dict[uuid.UUID, SemanticEntity],
        dict[uuid.UUID, SemanticField],
    ]:
        entities = list(
            (
                await self.session.scalars(
                    select(SchemaEntity).where(SchemaEntity.connection_id == connection_id)
                )
            ).all()
        )
        entity_ids = [item.id for item in entities]
        fields = (
            list(
                (
                    await self.session.scalars(
                        select(SchemaField).where(SchemaField.entity_id.in_(entity_ids))
                    )
                ).all()
            )
            if entity_ids
            else []
        )
        semantics = list(
            (
                await self.session.scalars(
                    select(SemanticEntity).where(SemanticEntity.connection_id == connection_id)
                )
            ).all()
        )
        field_semantics = (
            list(
                (
                    await self.session.scalars(
                        select(SemanticField).where(
                            SemanticField.schema_field_id.in_([item.id for item in fields])
                        )
                    )
                ).all()
            )
            if fields
            else []
        )
        return (
            {item.id: item for item in entities},
            {item.id: item for item in fields},
            {item.schema_entity_id: item for item in semantics},
            {item.schema_field_id: item for item in field_semantics},
        )
