import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.schema import (
    SchemaChange,
    SchemaEntity,
    SchemaField,
    SchemaIndex,
    SchemaIndexField,
    SchemaPhysicalRelationship,
    SchemaRelationshipField,
    SchemaSynchronization,
)
from app.domain.schema.models import (
    ChangeType,
    InspectedEntity,
    InspectedField,
    InspectedIndex,
    InspectedRelationship,
    InspectedSchema,
    ObjectType,
)


class SchemaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def try_lock(self, connection_id: uuid.UUID) -> bool:
        key = connection_id.int % (2**63 - 1)
        return bool(
            (
                await self.session.execute(
                    text("SELECT pg_try_advisory_lock(:lock_key)"), {"lock_key": key}
                )
            ).scalar_one()
        )

    async def unlock(self, connection_id: uuid.UUID) -> None:
        key = connection_id.int % (2**63 - 1)
        await self.session.execute(text("SELECT pg_advisory_unlock(:lock_key)"), {"lock_key": key})

    async def create_synchronization(self, connection_id: uuid.UUID) -> SchemaSynchronization:
        synchronization = SchemaSynchronization(
            connection_id=connection_id,
            status="running",
            started_at=datetime.now(UTC),
        )
        self.session.add(synchronization)
        await self.session.flush()
        return synchronization

    async def get_synchronization(
        self, connection_id: uuid.UUID, synchronization_id: uuid.UUID
    ) -> SchemaSynchronization | None:
        return (
            await self.session.scalars(
                select(SchemaSynchronization).where(
                    SchemaSynchronization.connection_id == connection_id,
                    SchemaSynchronization.id == synchronization_id,
                )
            )
        ).one_or_none()

    async def list_synchronizations(
        self, connection_id: uuid.UUID, page: int, page_size: int
    ) -> tuple[list[SchemaSynchronization], int]:
        base = SchemaSynchronization.connection_id == connection_id
        total = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(SchemaSynchronization).where(base)
                )
            ).scalar_one()
        )
        items = list(
            (
                await self.session.scalars(
                    select(SchemaSynchronization)
                    .where(base)
                    .order_by(SchemaSynchronization.started_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def latest_synchronization(
        self, connection_id: uuid.UUID
    ) -> SchemaSynchronization | None:
        return (
            await self.session.scalars(
                select(SchemaSynchronization)
                .where(SchemaSynchronization.connection_id == connection_id)
                .order_by(SchemaSynchronization.started_at.desc())
                .limit(1)
            )
        ).one_or_none()

    async def summary_counts(self, connection_id: uuid.UUID) -> dict[str, int]:
        async def count(model: Any, *conditions: Any) -> int:
            return int(
                (
                    await self.session.execute(
                        select(func.count()).select_from(model).where(*conditions)
                    )
                ).scalar_one()
            )

        active_entities = SchemaEntity.connection_id == connection_id
        active_entity_ids = select(SchemaEntity.id).where(
            active_entities, SchemaEntity.is_active.is_(True)
        )
        return {
            "tables": await count(
                SchemaEntity,
                active_entities,
                SchemaEntity.entity_type == "table",
                SchemaEntity.is_active.is_(True),
            ),
            "views": await count(
                SchemaEntity,
                active_entities,
                SchemaEntity.entity_type == "view",
                SchemaEntity.is_active.is_(True),
            ),
            "inactive_entities": await count(
                SchemaEntity, active_entities, SchemaEntity.is_active.is_(False)
            ),
            "fields": await count(
                SchemaField,
                SchemaField.entity_id.in_(active_entity_ids),
                SchemaField.is_active.is_(True),
            ),
            "indexes": await count(
                SchemaIndex,
                SchemaIndex.entity_id.in_(active_entity_ids),
                SchemaIndex.is_active.is_(True),
            ),
            "physical_relationships": await count(
                SchemaPhysicalRelationship,
                SchemaPhysicalRelationship.connection_id == connection_id,
                SchemaPhysicalRelationship.is_active.is_(True),
            ),
        }

    async def list_entities(
        self,
        connection_id: uuid.UUID,
        *,
        search: str | None,
        entity_type: str | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        filters: list[Any] = [SchemaEntity.connection_id == connection_id]
        if search:
            filters.append(SchemaEntity.physical_name.ilike(f"%{search}%"))
        if entity_type:
            filters.append(SchemaEntity.entity_type == entity_type)
        if is_active is not None:
            filters.append(SchemaEntity.is_active.is_(is_active))
        total = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(SchemaEntity).where(*filters)
                )
            ).scalar_one()
        )
        items = list(
            (
                await self.session.scalars(
                    select(SchemaEntity)
                    .where(*filters)
                    .order_by(SchemaEntity.physical_name)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        entity_ids = [entity.id for entity in items]
        field_counts: dict[uuid.UUID, int] = {}
        primary_keys: set[uuid.UUID] = set()
        index_counts: dict[uuid.UUID, int] = {}
        relationship_counts: dict[uuid.UUID, int] = {}
        if entity_ids:
            field_rows = (
                await self.session.execute(
                    select(
                        SchemaField.entity_id,
                        func.count(),
                        func.bool_or(SchemaField.is_primary_key),
                    )
                    .where(
                        SchemaField.entity_id.in_(entity_ids),
                        SchemaField.is_active.is_(True),
                    )
                    .group_by(SchemaField.entity_id)
                )
            ).all()
            field_counts = {row[0]: int(row[1]) for row in field_rows}
            primary_keys = {row[0] for row in field_rows if row[2]}
            index_counts = {
                row[0]: int(row[1])
                for row in (
                    await self.session.execute(
                        select(SchemaIndex.entity_id, func.count())
                        .where(
                            SchemaIndex.entity_id.in_(entity_ids),
                            SchemaIndex.is_active.is_(True),
                        )
                        .group_by(SchemaIndex.entity_id)
                    )
                ).all()
            }
            relationship_rows = (
                await self.session.execute(
                    select(
                        SchemaPhysicalRelationship.source_entity_id,
                        SchemaPhysicalRelationship.target_entity_id,
                    ).where(
                        SchemaPhysicalRelationship.connection_id == connection_id,
                        SchemaPhysicalRelationship.is_active.is_(True),
                    )
                )
            ).all()
            for source_id, target_id in relationship_rows:
                if source_id in entity_ids:
                    relationship_counts[source_id] = relationship_counts.get(source_id, 0) + 1
                if target_id in entity_ids and target_id != source_id:
                    relationship_counts[target_id] = relationship_counts.get(target_id, 0) + 1

        result = []
        for entity in items:
            result.append(
                {
                    "id": entity.id,
                    "physical_name": entity.physical_name,
                    "display_name": entity.display_name,
                    "entity_type": entity.entity_type,
                    "is_active": entity.is_active,
                    "fields_count": field_counts.get(entity.id, 0),
                    "has_primary_key": entity.id in primary_keys,
                    "indexes_count": index_counts.get(entity.id, 0),
                    "relationships_count": relationship_counts.get(entity.id, 0),
                }
            )
        return result, total

    async def get_entity(
        self, connection_id: uuid.UUID, entity_id: uuid.UUID
    ) -> SchemaEntity | None:
        return (
            await self.session.scalars(
                select(SchemaEntity).where(
                    SchemaEntity.connection_id == connection_id,
                    SchemaEntity.id == entity_id,
                )
            )
        ).one_or_none()

    async def entity_fields(self, entity_id: uuid.UUID) -> list[SchemaField]:
        return list(
            (
                await self.session.scalars(
                    select(SchemaField)
                    .where(SchemaField.entity_id == entity_id)
                    .order_by(SchemaField.ordinal_position)
                )
            ).all()
        )

    async def entity_indexes(self, entity_id: uuid.UUID) -> list[dict[str, Any]]:
        indexes = list(
            (
                await self.session.scalars(
                    select(SchemaIndex)
                    .where(SchemaIndex.entity_id == entity_id)
                    .order_by(SchemaIndex.physical_name)
                )
            ).all()
        )
        result = []
        for index in indexes:
            items = (
                await self.session.execute(
                    select(SchemaIndexField, SchemaField.physical_name)
                    .outerjoin(SchemaField, SchemaField.id == SchemaIndexField.field_id)
                    .where(SchemaIndexField.index_id == index.id)
                    .order_by(SchemaIndexField.sequence)
                )
            ).all()
            result.append({"model": index, "fields": items})
        return result

    async def relationships(
        self, connection_id: uuid.UUID, entity_id: uuid.UUID | None = None
    ) -> list[dict[str, Any]]:
        query = select(SchemaPhysicalRelationship).where(
            SchemaPhysicalRelationship.connection_id == connection_id
        )
        if entity_id:
            query = query.where(
                or_(
                    SchemaPhysicalRelationship.source_entity_id == entity_id,
                    SchemaPhysicalRelationship.target_entity_id == entity_id,
                )
            )
        models = list((await self.session.scalars(query)).all())
        entities = {
            item.id: item.physical_name
            for item in (
                await self.session.scalars(
                    select(SchemaEntity).where(SchemaEntity.connection_id == connection_id)
                )
            ).all()
        }
        result = []
        for model in models:
            rows = (
                await self.session.execute(
                    select(
                        SchemaRelationshipField,
                        SchemaField.physical_name,
                    )
                    .join(
                        SchemaField,
                        SchemaField.id == SchemaRelationshipField.source_field_id,
                    )
                    .where(SchemaRelationshipField.relationship_id == model.id)
                    .order_by(SchemaRelationshipField.sequence)
                )
            ).all()
            target_names = {
                item.id: item.physical_name
                for item in (
                    await self.session.scalars(
                        select(SchemaField).where(
                            SchemaField.id.in_([row[0].target_field_id for row in rows])
                        )
                    )
                ).all()
            }
            result.append(
                {
                    "model": model,
                    "source_entity": entities[model.source_entity_id],
                    "target_entity": entities[model.target_entity_id],
                    "fields": [
                        (row[0], row[1], target_names[row[0].target_field_id]) for row in rows
                    ],
                }
            )
        return result

    async def list_changes(
        self,
        connection_id: uuid.UUID,
        synchronization_id: uuid.UUID | None,
        change_type: str | None,
        object_type: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[SchemaChange], int]:
        sync_ids = select(SchemaSynchronization.id).where(
            SchemaSynchronization.connection_id == connection_id
        )
        filters: list[Any] = [SchemaChange.synchronization_id.in_(sync_ids)]
        if synchronization_id:
            filters.append(SchemaChange.synchronization_id == synchronization_id)
        if change_type:
            filters.append(SchemaChange.change_type == change_type)
        if object_type:
            filters.append(SchemaChange.object_type == object_type)
        total = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(SchemaChange).where(*filters)
                )
            ).scalar_one()
        )
        items = list(
            (
                await self.session.scalars(
                    select(SchemaChange)
                    .where(*filters)
                    .order_by(SchemaChange.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def apply(
        self,
        connection_id: uuid.UUID,
        synchronization: SchemaSynchronization,
        inspected: InspectedSchema,
    ) -> dict[str, int]:
        now = datetime.now(UTC)
        counters = {
            "entities_added": 0,
            "entities_updated": 0,
            "entities_removed": 0,
            "fields_added": 0,
            "fields_updated": 0,
            "fields_removed": 0,
        }
        entities = list(
            (
                await self.session.scalars(
                    select(SchemaEntity).where(SchemaEntity.connection_id == connection_id)
                )
            ).all()
        )
        entity_by_key = {(item.schema_name, item.physical_name): item for item in entities}
        seen_entities: set[uuid.UUID] = set()
        inspected_by_entity: dict[uuid.UUID, InspectedEntity] = {}
        for source in inspected.entities:
            key = (source.schema_name, source.physical_name)
            model = entity_by_key.get(key)
            current = _entity_snapshot(source)
            if model is None:
                model = SchemaEntity(
                    connection_id=connection_id,
                    physical_name=source.physical_name,
                    display_name=source.physical_name,
                    entity_type=source.entity_type,
                    engine="mysql",
                    schema_name=source.schema_name,
                    comment=source.comment,
                    estimated_rows=source.estimated_rows,
                    storage_engine=source.storage_engine,
                    collation=source.collation,
                    is_active=True,
                    first_seen_at=now,
                    last_seen_at=now,
                )
                self.session.add(model)
                await self.session.flush()
                counters["entities_added"] += 1
                self._change(
                    synchronization.id,
                    ChangeType.ADDED,
                    ObjectType.ENTITY,
                    model.id,
                    source.physical_name,
                    None,
                    current,
                )
            else:
                previous = _entity_model_snapshot(model)
                change = (
                    ChangeType.REACTIVATED
                    if not model.is_active
                    else ChangeType.UPDATED
                    if previous != current
                    else None
                )
                if change is not None:
                    counters["entities_updated"] += 1
                    self._change(
                        synchronization.id,
                        change,
                        ObjectType.ENTITY,
                        model.id,
                        source.physical_name,
                        previous,
                        current,
                    )
                _assign_entity(model, source)
                model.is_active = True
                model.last_seen_at = now
            seen_entities.add(model.id)
            inspected_by_entity[model.id] = source
        for model in entities:
            if model.id not in seen_entities and model.is_active:
                model.is_active = False
                counters["entities_removed"] += 1
                self._change(
                    synchronization.id,
                    ChangeType.REMOVED,
                    ObjectType.ENTITY,
                    model.id,
                    model.physical_name,
                    _entity_model_snapshot(model),
                    None,
                )
                removed_fields = list(
                    (
                        await self.session.scalars(
                            select(SchemaField).where(
                                SchemaField.entity_id == model.id,
                                SchemaField.is_active.is_(True),
                            )
                        )
                    ).all()
                )
                for field in removed_fields:
                    field.is_active = False
                    counters["fields_removed"] += 1
                    self._change(
                        synchronization.id,
                        ChangeType.REMOVED,
                        ObjectType.FIELD,
                        field.id,
                        f"{model.physical_name}.{field.physical_name}",
                        _field_model_snapshot(field),
                        None,
                    )
                removed_indexes = list(
                    (
                        await self.session.scalars(
                            select(SchemaIndex).where(
                                SchemaIndex.entity_id == model.id,
                                SchemaIndex.is_active.is_(True),
                            )
                        )
                    ).all()
                )
                for index in removed_indexes:
                    index.is_active = False
                    self._change(
                        synchronization.id,
                        ChangeType.REMOVED,
                        ObjectType.INDEX,
                        index.id,
                        f"{model.physical_name}.{index.physical_name}",
                        await self._index_model_snapshot(index),
                        None,
                    )

        await self.session.flush()
        fields_by_entity: dict[uuid.UUID, dict[str, SchemaField]] = {}
        for entity_id, source_entity in inspected_by_entity.items():
            existing = list(
                (
                    await self.session.scalars(
                        select(SchemaField).where(SchemaField.entity_id == entity_id)
                    )
                ).all()
            )
            by_name = {item.physical_name: item for item in existing}
            seen: set[uuid.UUID] = set()
            for source_field in source_entity.fields:
                field_model = by_name.get(source_field.physical_name)
                current = _field_snapshot(source_field)
                if field_model is None:
                    field_model = SchemaField(
                        entity_id=entity_id,
                        physical_name=source_field.physical_name,
                        display_name=source_field.physical_name,
                        is_active=True,
                        first_seen_at=now,
                        last_seen_at=now,
                        **current,
                    )
                    self.session.add(field_model)
                    await self.session.flush()
                    counters["fields_added"] += 1
                    self._change(
                        synchronization.id,
                        ChangeType.ADDED,
                        ObjectType.FIELD,
                        field_model.id,
                        f"{source_entity.physical_name}.{source_field.physical_name}",
                        None,
                        current,
                    )
                else:
                    previous = _field_model_snapshot(field_model)
                    field_change: ChangeType | None = (
                        ChangeType.REACTIVATED
                        if not field_model.is_active
                        else ChangeType.UPDATED
                        if previous != current
                        else None
                    )
                    if field_change is not None:
                        counters["fields_updated"] += 1
                        self._change(
                            synchronization.id,
                            field_change,
                            ObjectType.FIELD,
                            field_model.id,
                            f"{source_entity.physical_name}.{source_field.physical_name}",
                            previous,
                            current,
                        )
                    for name, value in current.items():
                        setattr(field_model, name, value)
                    field_model.is_active = True
                    field_model.last_seen_at = now
                seen.add(field_model.id)
            for existing_field in existing:
                if existing_field.id not in seen and existing_field.is_active:
                    existing_field.is_active = False
                    counters["fields_removed"] += 1
                    self._change(
                        synchronization.id,
                        ChangeType.REMOVED,
                        ObjectType.FIELD,
                        existing_field.id,
                        f"{source_entity.physical_name}.{existing_field.physical_name}",
                        _field_model_snapshot(existing_field),
                        None,
                    )
            await self.session.flush()
            fields_by_entity[entity_id] = {
                item.physical_name: item
                for item in (
                    await self.session.scalars(
                        select(SchemaField).where(SchemaField.entity_id == entity_id)
                    )
                ).all()
            }

        await self._apply_indexes(synchronization.id, inspected_by_entity, fields_by_entity, now)
        await self._apply_relationships(
            connection_id, synchronization.id, inspected, fields_by_entity, now
        )
        return counters

    async def _apply_indexes(
        self,
        synchronization_id: uuid.UUID,
        entities: dict[uuid.UUID, InspectedEntity],
        fields: dict[uuid.UUID, dict[str, SchemaField]],
        now: datetime,
    ) -> None:
        for entity_id, source_entity in entities.items():
            existing = list(
                (
                    await self.session.scalars(
                        select(SchemaIndex).where(SchemaIndex.entity_id == entity_id)
                    )
                ).all()
            )
            by_name = {item.physical_name: item for item in existing}
            seen: set[uuid.UUID] = set()
            for source in source_entity.indexes:
                model = by_name.get(source.physical_name)
                current = _index_snapshot(source)
                change: ChangeType | None
                if model is None:
                    model = SchemaIndex(
                        entity_id=entity_id,
                        physical_name=source.physical_name,
                        is_active=True,
                        first_seen_at=now,
                        last_seen_at=now,
                        index_type=source.index_type,
                        is_unique=source.is_unique,
                        is_primary=source.is_primary,
                    )
                    self.session.add(model)
                    await self.session.flush()
                    change = ChangeType.ADDED
                    previous = None
                else:
                    previous = await self._index_model_snapshot(model)
                    change = (
                        ChangeType.REACTIVATED
                        if not model.is_active
                        else ChangeType.UPDATED
                        if previous != current
                        else None
                    )
                    model.index_type = source.index_type
                    model.is_unique = source.is_unique
                    model.is_primary = source.is_primary
                    model.is_active = True
                    model.last_seen_at = now
                await self.session.execute(
                    delete(SchemaIndexField).where(SchemaIndexField.index_id == model.id)
                )
                for item in source.fields:
                    self.session.add(
                        SchemaIndexField(
                            index_id=model.id,
                            field_id=(
                                fields[entity_id][item.physical_name].id
                                if item.physical_name in fields[entity_id]
                                else None
                            ),
                            sequence=item.sequence,
                            sort_direction=item.sort_direction,
                            prefix_length=item.prefix_length,
                        )
                    )
                if change is not None:
                    self._change(
                        synchronization_id,
                        change,
                        ObjectType.INDEX,
                        model.id,
                        f"{source_entity.physical_name}.{source.physical_name}",
                        previous,
                        current,
                    )
                seen.add(model.id)
            for model in existing:
                if model.id not in seen and model.is_active:
                    model.is_active = False
                    self._change(
                        synchronization_id,
                        ChangeType.REMOVED,
                        ObjectType.INDEX,
                        model.id,
                        f"{source_entity.physical_name}.{model.physical_name}",
                        await self._index_model_snapshot(model),
                        None,
                    )

    async def _apply_relationships(
        self,
        connection_id: uuid.UUID,
        synchronization_id: uuid.UUID,
        inspected: InspectedSchema,
        fields: dict[uuid.UUID, dict[str, SchemaField]],
        now: datetime,
    ) -> None:
        all_entities = list(
            (
                await self.session.scalars(
                    select(SchemaEntity).where(SchemaEntity.connection_id == connection_id)
                )
            ).all()
        )
        entity_by_name = {item.physical_name: item for item in all_entities}
        existing = list(
            (
                await self.session.scalars(
                    select(SchemaPhysicalRelationship).where(
                        SchemaPhysicalRelationship.connection_id == connection_id
                    )
                )
            ).all()
        )
        by_key = {
            (item.constraint_name, item.source_entity_id, item.target_entity_id): item
            for item in existing
        }
        seen: set[uuid.UUID] = set()
        for source in inspected.relationships:
            source_entity = entity_by_name[source.source_entity]
            target_entity = entity_by_name[source.target_entity]
            key = (source.constraint_name, source_entity.id, target_entity.id)
            model = by_key.get(key)
            current = _relationship_snapshot(source)
            change: ChangeType | None
            if model is None:
                model = SchemaPhysicalRelationship(
                    connection_id=connection_id,
                    constraint_name=source.constraint_name,
                    source_entity_id=source_entity.id,
                    target_entity_id=target_entity.id,
                    update_rule=source.update_rule,
                    delete_rule=source.delete_rule,
                    is_active=True,
                    first_seen_at=now,
                    last_seen_at=now,
                )
                self.session.add(model)
                await self.session.flush()
                change = ChangeType.ADDED
                previous = None
            else:
                previous = await self._relationship_model_snapshot(model)
                change = (
                    ChangeType.REACTIVATED
                    if not model.is_active
                    else ChangeType.UPDATED
                    if previous != current
                    else None
                )
                model.update_rule = source.update_rule
                model.delete_rule = source.delete_rule
                model.is_active = True
                model.last_seen_at = now
            await self.session.execute(
                delete(SchemaRelationshipField).where(
                    SchemaRelationshipField.relationship_id == model.id
                )
            )
            for item in source.fields:
                self.session.add(
                    SchemaRelationshipField(
                        relationship_id=model.id,
                        source_field_id=fields[source_entity.id][item.source_field].id,
                        target_field_id=fields[target_entity.id][item.target_field].id,
                        sequence=item.sequence,
                    )
                )
            if change is not None:
                self._change(
                    synchronization_id,
                    change,
                    ObjectType.RELATIONSHIP,
                    model.id,
                    source.constraint_name,
                    previous,
                    current,
                )
            seen.add(model.id)
        for model in existing:
            if model.id not in seen and model.is_active:
                model.is_active = False
                self._change(
                    synchronization_id,
                    ChangeType.REMOVED,
                    ObjectType.RELATIONSHIP,
                    model.id,
                    model.constraint_name,
                    await self._relationship_model_snapshot(model),
                    None,
                )

    def _change(
        self,
        synchronization_id: uuid.UUID,
        change_type: ChangeType,
        object_type: ObjectType,
        object_id: uuid.UUID,
        physical_name: str,
        previous: dict[str, Any] | None,
        current: dict[str, Any] | None,
    ) -> None:
        self.session.add(
            SchemaChange(
                synchronization_id=synchronization_id,
                change_type=change_type,
                object_type=object_type,
                object_id=object_id,
                physical_name=physical_name,
                previous_value_json=previous,
                current_value_json=current,
            )
        )

    async def _index_model_snapshot(self, model: SchemaIndex) -> dict[str, Any]:
        items = list(
            (
                await self.session.scalars(
                    select(SchemaIndexField)
                    .where(SchemaIndexField.index_id == model.id)
                    .order_by(SchemaIndexField.sequence)
                )
            ).all()
        )
        field_ids = {item.field_id for item in items if item.field_id}
        names = {
            item.id: item.physical_name
            for item in (
                await self.session.scalars(select(SchemaField).where(SchemaField.id.in_(field_ids)))
            ).all()
        }
        return {
            "index_type": model.index_type,
            "is_unique": model.is_unique,
            "is_primary": model.is_primary,
            "fields": [
                [
                    names.get(item.field_id) if item.field_id is not None else None,
                    item.sequence,
                    item.sort_direction,
                    item.prefix_length,
                ]
                for item in items
            ],
        }

    async def _relationship_model_snapshot(
        self, model: SchemaPhysicalRelationship
    ) -> dict[str, Any]:
        items = list(
            (
                await self.session.scalars(
                    select(SchemaRelationshipField)
                    .where(SchemaRelationshipField.relationship_id == model.id)
                    .order_by(SchemaRelationshipField.sequence)
                )
            ).all()
        )
        field_ids = {
            value for item in items for value in (item.source_field_id, item.target_field_id)
        }
        names = {
            item.id: item.physical_name
            for item in (
                await self.session.scalars(select(SchemaField).where(SchemaField.id.in_(field_ids)))
            ).all()
        }
        return {
            "update_rule": model.update_rule,
            "delete_rule": model.delete_rule,
            "fields": [
                [names[item.source_field_id], names[item.target_field_id], item.sequence]
                for item in items
            ],
        }


def _entity_snapshot(source: InspectedEntity) -> dict[str, Any]:
    return {
        "entity_type": source.entity_type,
        "comment": source.comment,
        "storage_engine": source.storage_engine,
        "collation": source.collation,
    }


def _entity_model_snapshot(model: SchemaEntity) -> dict[str, Any]:
    return {
        "entity_type": model.entity_type,
        "comment": model.comment,
        "storage_engine": model.storage_engine,
        "collation": model.collation,
    }


def _assign_entity(model: SchemaEntity, source: InspectedEntity) -> None:
    model.entity_type = source.entity_type
    model.comment = source.comment
    model.estimated_rows = source.estimated_rows
    model.storage_engine = source.storage_engine
    model.collation = source.collation


def _field_snapshot(source: InspectedField) -> dict[str, Any]:
    return {
        name: getattr(source, name)
        for name in (
            "ordinal_position",
            "native_data_type",
            "normalized_data_type",
            "column_type",
            "is_nullable",
            "default_value",
            "is_primary_key",
            "is_unique",
            "is_auto_increment",
            "character_maximum_length",
            "numeric_precision",
            "numeric_scale",
            "datetime_precision",
            "character_set",
            "collation",
            "comment",
            "extra",
        )
    }


def _field_model_snapshot(model: SchemaField) -> dict[str, Any]:
    return {
        name: getattr(model, name)
        for name in (
            "ordinal_position",
            "native_data_type",
            "normalized_data_type",
            "column_type",
            "is_nullable",
            "default_value",
            "is_primary_key",
            "is_unique",
            "is_auto_increment",
            "character_maximum_length",
            "numeric_precision",
            "numeric_scale",
            "datetime_precision",
            "character_set",
            "collation",
            "comment",
            "extra",
        )
    }


def _index_snapshot(source: InspectedIndex) -> dict[str, Any]:
    return {
        "index_type": source.index_type,
        "is_unique": source.is_unique,
        "is_primary": source.is_primary,
        "fields": [
            [item.physical_name, item.sequence, item.sort_direction, item.prefix_length]
            for item in source.fields
        ],
    }


def _relationship_snapshot(source: InspectedRelationship) -> dict[str, Any]:
    return {
        "update_rule": source.update_rule,
        "delete_rule": source.delete_rule,
        "fields": [[item.source_field, item.target_field, item.sequence] for item in source.fields],
    }
