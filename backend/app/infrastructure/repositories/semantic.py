import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.schema import (
    SchemaEntity,
    SchemaField,
    SchemaIndex,
    SchemaIndexField,
    SchemaPhysicalRelationship,
    SchemaRelationshipField,
)
from app.db.models.semantic import (
    PolymorphicRelationship,
    PolymorphicRelationshipMapping,
    SemanticEntity,
    SemanticField,
    SemanticRelationship,
    SemanticRelationshipField,
)
from app.domain.relationships.models import CatalogEntity, CatalogField, RelationshipCandidate


class SemanticCatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def catalog(self, connection_id: uuid.UUID) -> list[CatalogEntity]:
        entities = list(
            (
                await self.session.scalars(
                    select(SchemaEntity)
                    .where(SchemaEntity.connection_id == connection_id)
                    .order_by(SchemaEntity.physical_name)
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
        indexed_ids = (
            set(
                (
                    await self.session.scalars(
                        select(SchemaIndexField.field_id)
                        .join(SchemaIndex, SchemaIndex.id == SchemaIndexField.index_id)
                        .where(
                            SchemaIndex.entity_id.in_(entity_ids),
                            SchemaIndex.is_active.is_(True),
                            SchemaIndexField.field_id.is_not(None),
                        )
                    )
                ).all()
            )
            if entity_ids
            else set()
        )
        by_entity: dict[uuid.UUID, list[CatalogField]] = {}
        for field in fields:
            by_entity.setdefault(field.entity_id, []).append(
                CatalogField(
                    id=field.id,
                    entity_id=field.entity_id,
                    physical_name=field.physical_name,
                    normalized_type=field.normalized_data_type,
                    column_type=field.column_type,
                    character_maximum_length=field.character_maximum_length,
                    numeric_precision=field.numeric_precision,
                    is_primary_key=field.is_primary_key,
                    is_unique=field.is_unique,
                    is_active=field.is_active,
                    is_indexed=field.id in indexed_ids,
                )
            )
        return [
            CatalogEntity(
                id=entity.id,
                physical_name=entity.physical_name,
                entity_type=entity.entity_type,
                is_active=entity.is_active,
                fields=by_entity.get(entity.id, []),
            )
            for entity in entities
        ]

    async def store_candidates(
        self, connection_id: uuid.UUID, candidates: list[RelationshipCandidate]
    ) -> tuple[int, int]:
        existing = {
            item.fingerprint: item
            for item in (
                await self.session.scalars(
                    select(SemanticRelationship).where(
                        SemanticRelationship.connection_id == connection_id
                    )
                )
            ).all()
        }
        created = 0
        preserved = 0
        for candidate in candidates:
            current = existing.get(candidate.fingerprint)
            if current is not None:
                if current.status == "rejected":
                    preserved += 1
                elif current.status == "suggested":
                    current.confidence_score = candidate.confidence_score
                    current.reasons_json = list(candidate.reasons)
                    current.warnings_json = list(candidate.warnings)
                continue
            relation = SemanticRelationship(
                connection_id=connection_id,
                relationship_type=candidate.relationship_type,
                status="suggested",
                detection_source=candidate.detection_source,
                source_entity_id=candidate.source_entity_id,
                target_entity_id=candidate.target_entity_id,
                name=f"suggestion_{candidate.fingerprint[:12]}",
                display_name="Relación sugerida",
                description=None,
                cardinality=candidate.cardinality,
                confidence_score=candidate.confidence_score,
                is_enabled=False,
                conditions_json=list(candidate.conditions),
                reasons_json=list(candidate.reasons),
                warnings_json=list(candidate.warnings),
                fingerprint=candidate.fingerprint,
                created_by="system",
                updated_by="system",
            )
            self.session.add(relation)
            await self.session.flush()
            for sequence, (source_id, target_id) in enumerate(
                zip(
                    candidate.source_field_ids,
                    candidate.target_field_ids,
                    strict=False,
                ),
                1,
            ):
                self.session.add(
                    SemanticRelationshipField(
                        relationship_id=relation.id,
                        source_field_id=source_id,
                        target_field_id=target_id,
                        sequence=sequence,
                        comparison_operator="equals",
                    )
                )
            created += 1
        return created, preserved

    async def semantic_relationships(
        self,
        connection_id: uuid.UUID,
        *,
        status: str | None = None,
        relationship_type: str | None = None,
    ) -> list[SemanticRelationship]:
        query = select(SemanticRelationship).where(
            SemanticRelationship.connection_id == connection_id
        )
        if status:
            query = query.where(SemanticRelationship.status == status)
        if relationship_type:
            query = query.where(SemanticRelationship.relationship_type == relationship_type)
        return list(
            (
                await self.session.scalars(
                    query.order_by(
                        SemanticRelationship.confidence_score.desc(),
                        SemanticRelationship.detected_at.desc(),
                    )
                )
            ).all()
        )

    async def relationship(
        self, connection_id: uuid.UUID, relationship_id: uuid.UUID
    ) -> SemanticRelationship | None:
        return (
            await self.session.scalars(
                select(SemanticRelationship).where(
                    SemanticRelationship.connection_id == connection_id,
                    SemanticRelationship.id == relationship_id,
                )
            )
        ).one_or_none()

    async def relationship_fields(
        self, relationship_id: uuid.UUID
    ) -> list[SemanticRelationshipField]:
        return list(
            (
                await self.session.scalars(
                    select(SemanticRelationshipField)
                    .where(SemanticRelationshipField.relationship_id == relationship_id)
                    .order_by(SemanticRelationshipField.sequence)
                )
            ).all()
        )

    async def replace_relationship_fields(
        self,
        relationship_id: uuid.UUID,
        pairs: list[tuple[uuid.UUID, uuid.UUID]],
    ) -> None:
        await self.session.execute(
            delete(SemanticRelationshipField).where(
                SemanticRelationshipField.relationship_id == relationship_id
            )
        )
        for sequence, (source, target) in enumerate(pairs, 1):
            self.session.add(
                SemanticRelationshipField(
                    relationship_id=relationship_id,
                    source_field_id=source,
                    target_field_id=target,
                    sequence=sequence,
                    comparison_operator="equals",
                )
            )

    async def physical_relationships(
        self, connection_id: uuid.UUID
    ) -> list[SchemaPhysicalRelationship]:
        return list(
            (
                await self.session.scalars(
                    select(SchemaPhysicalRelationship).where(
                        SchemaPhysicalRelationship.connection_id == connection_id
                    )
                )
            ).all()
        )

    async def physical_fields(self, relationship_id: uuid.UUID) -> list[SchemaRelationshipField]:
        return list(
            (
                await self.session.scalars(
                    select(SchemaRelationshipField)
                    .where(SchemaRelationshipField.relationship_id == relationship_id)
                    .order_by(SchemaRelationshipField.sequence)
                )
            ).all()
        )

    async def entity(self, connection_id: uuid.UUID, entity_id: uuid.UUID) -> SchemaEntity | None:
        return (
            await self.session.scalars(
                select(SchemaEntity).where(
                    SchemaEntity.connection_id == connection_id,
                    SchemaEntity.id == entity_id,
                )
            )
        ).one_or_none()

    async def field(
        self, connection_id: uuid.UUID, field_id: uuid.UUID
    ) -> tuple[SchemaField, SchemaEntity] | None:
        row = (
            await self.session.execute(
                select(SchemaField, SchemaEntity)
                .join(SchemaEntity, SchemaEntity.id == SchemaField.entity_id)
                .where(
                    SchemaEntity.connection_id == connection_id,
                    SchemaField.id == field_id,
                )
            )
        ).one_or_none()
        return (row[0], row[1]) if row else None

    async def fields_by_ids(
        self, connection_id: uuid.UUID, field_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, SchemaField]:
        if not field_ids:
            return {}
        items = (
            await self.session.scalars(
                select(SchemaField)
                .join(SchemaEntity, SchemaEntity.id == SchemaField.entity_id)
                .where(
                    SchemaEntity.connection_id == connection_id,
                    SchemaField.id.in_(field_ids),
                )
            )
        ).all()
        return {item.id: item for item in items}

    async def semantic_names(self, connection_id: uuid.UUID) -> dict[uuid.UUID, SemanticEntity]:
        return {
            item.schema_entity_id: item
            for item in (
                await self.session.scalars(
                    select(SemanticEntity).where(SemanticEntity.connection_id == connection_id)
                )
            ).all()
        }

    async def semantic_field_configs(
        self, field_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, SemanticField]:
        if not field_ids:
            return {}
        return {
            item.schema_field_id: item
            for item in (
                await self.session.scalars(
                    select(SemanticField).where(SemanticField.schema_field_id.in_(field_ids))
                )
            ).all()
        }

    async def polymorphic_relationships(
        self, connection_id: uuid.UUID
    ) -> list[PolymorphicRelationship]:
        return list(
            (
                await self.session.scalars(
                    select(PolymorphicRelationship).where(
                        PolymorphicRelationship.connection_id == connection_id
                    )
                )
            ).all()
        )

    async def polymorphic(
        self, connection_id: uuid.UUID, relationship_id: uuid.UUID
    ) -> PolymorphicRelationship | None:
        return (
            await self.session.scalars(
                select(PolymorphicRelationship).where(
                    PolymorphicRelationship.connection_id == connection_id,
                    PolymorphicRelationship.id == relationship_id,
                )
            )
        ).one_or_none()

    async def mappings(self, relationship_id: uuid.UUID) -> list[PolymorphicRelationshipMapping]:
        return list(
            (
                await self.session.scalars(
                    select(PolymorphicRelationshipMapping)
                    .where(
                        PolymorphicRelationshipMapping.polymorphic_relationship_id
                        == relationship_id
                    )
                    .order_by(PolymorphicRelationshipMapping.type_value)
                )
            ).all()
        )

    async def mapping(
        self, relationship_id: uuid.UUID, mapping_id: uuid.UUID
    ) -> PolymorphicRelationshipMapping | None:
        return (
            await self.session.scalars(
                select(PolymorphicRelationshipMapping).where(
                    PolymorphicRelationshipMapping.polymorphic_relationship_id == relationship_id,
                    PolymorphicRelationshipMapping.id == mapping_id,
                )
            )
        ).one_or_none()

    async def semantic_entities(
        self, connection_id: uuid.UUID
    ) -> list[tuple[SchemaEntity, SemanticEntity | None]]:
        rows = (
            await self.session.execute(
                select(SchemaEntity, SemanticEntity)
                .outerjoin(
                    SemanticEntity,
                    SemanticEntity.schema_entity_id == SchemaEntity.id,
                )
                .where(SchemaEntity.connection_id == connection_id)
                .order_by(SchemaEntity.physical_name)
            )
        ).all()
        return [(row[0], row[1]) for row in rows]

    async def upsert_semantic_entity(
        self, connection_id: uuid.UUID, entity: SchemaEntity
    ) -> SemanticEntity:
        model = (
            await self.session.scalars(
                select(SemanticEntity).where(SemanticEntity.schema_entity_id == entity.id)
            )
        ).one_or_none()
        if model is None:
            model = SemanticEntity(
                connection_id=connection_id,
                schema_entity_id=entity.id,
                display_name=entity.display_name,
            )
            self.session.add(model)
            await self.session.flush()
        return model

    async def upsert_semantic_field(self, field: SchemaField) -> SemanticField:
        model = (
            await self.session.scalars(
                select(SemanticField).where(SemanticField.schema_field_id == field.id)
            )
        ).one_or_none()
        if model is None:
            model = SemanticField(
                schema_field_id=field.id,
                display_name=field.display_name,
            )
            self.session.add(model)
            await self.session.flush()
        return model

    async def invalidate_broken(self, connection_id: uuid.UUID) -> int:
        relationships = await self.semantic_relationships(connection_id)
        invalidated = 0
        for relation in relationships:
            if relation.status in {"rejected", "suggested"}:
                continue
            source = await self.entity(connection_id, relation.source_entity_id)
            target = (
                await self.entity(connection_id, relation.target_entity_id)
                if relation.target_entity_id
                else None
            )
            fields = await self.relationship_fields(relation.id)
            field_models = await self.fields_by_ids(
                connection_id,
                [item.source_field_id for item in fields]
                + [item.target_field_id for item in fields],
            )
            reason = None
            if source is None or not source.is_active or target is None or not target.is_active:
                reason = "Una entidad relacionada ya no está activa."
            elif any(
                not field_models.get(item.source_field_id)
                or not field_models[item.source_field_id].is_active
                for item in fields
            ):
                reason = "Un campo origen ya no está activo."
            elif any(
                not field_models.get(item.target_field_id)
                or not field_models[item.target_field_id].is_active
                for item in fields
            ):
                reason = "Un campo destino ya no está activo."
            if reason:
                relation.status = "invalid"
                relation.is_enabled = False
                relation.invalid_reason = reason
                invalidated += 1
        polymorphic = await self.polymorphic_relationships(connection_id)
        for polymorphic_relation in polymorphic:
            source = await self.entity(connection_id, polymorphic_relation.source_entity_id)
            polymorphic_fields = await self.fields_by_ids(
                connection_id,
                [
                    polymorphic_relation.type_field_id,
                    polymorphic_relation.id_field_id,
                ],
            )
            if (
                source is None
                or not source.is_active
                or any(
                    not polymorphic_fields.get(field_id)
                    or not polymorphic_fields[field_id].is_active
                    for field_id in (
                        polymorphic_relation.type_field_id,
                        polymorphic_relation.id_field_id,
                    )
                )
            ):
                polymorphic_relation.status = "invalid"
                polymorphic_relation.is_enabled = False
                polymorphic_relation.invalid_reason = (
                    "La entidad o los campos polimórficos ya no están activos."
                )
                invalidated += 1
        return invalidated

    async def delete_relationship(self, relationship: SemanticRelationship) -> None:
        await self.session.delete(relationship)

    async def delete_polymorphic(self, relationship: PolymorphicRelationship) -> None:
        await self.session.delete(relationship)

    async def delete_mapping(self, mapping: PolymorphicRelationshipMapping) -> None:
        await self.session.delete(mapping)
