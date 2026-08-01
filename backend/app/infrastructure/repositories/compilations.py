import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.query import QueryCompilation
from app.db.models.schema import (
    SchemaEntity,
    SchemaField,
    SchemaPhysicalRelationship,
    SchemaRelationshipField,
)
from app.db.models.semantic import (
    PolymorphicRelationship,
    PolymorphicRelationshipMapping,
    SemanticRelationship,
    SemanticRelationshipField,
)
from app.domain.query_compiler.models import (
    CatalogEntity,
    CatalogField,
    CatalogRelationship,
    CatalogSnapshot,
    PolymorphicMappingSnapshot,
    PolymorphicRelationshipSnapshot,
    RelationshipPair,
)


class CompilationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def snapshot(self, connection_id: uuid.UUID) -> CatalogSnapshot:
        entities = list(
            await self.session.scalars(
                select(SchemaEntity).where(SchemaEntity.connection_id == connection_id)
            )
        )
        entity_ids = [item.id for item in entities]
        fields = (
            list(
                await self.session.scalars(
                    select(SchemaField).where(SchemaField.entity_id.in_(entity_ids))
                )
            )
            if entity_ids
            else []
        )
        physical = list(
            await self.session.scalars(
                select(SchemaPhysicalRelationship).where(
                    SchemaPhysicalRelationship.connection_id == connection_id
                )
            )
        )
        semantic = list(
            await self.session.scalars(
                select(SemanticRelationship).where(
                    SemanticRelationship.connection_id == connection_id
                )
            )
        )
        polymorphic = list(
            await self.session.scalars(
                select(PolymorphicRelationship).where(
                    PolymorphicRelationship.connection_id == connection_id
                )
            )
        )
        physical_ids = [item.id for item in physical]
        semantic_ids = [item.id for item in semantic]
        polymorphic_ids = [item.id for item in polymorphic]
        physical_fields = (
            list(
                await self.session.scalars(
                    select(SchemaRelationshipField)
                    .where(SchemaRelationshipField.relationship_id.in_(physical_ids))
                    .order_by(
                        SchemaRelationshipField.relationship_id, SchemaRelationshipField.sequence
                    )
                )
            )
            if physical_ids
            else []
        )
        semantic_fields = (
            list(
                await self.session.scalars(
                    select(SemanticRelationshipField)
                    .where(SemanticRelationshipField.relationship_id.in_(semantic_ids))
                    .order_by(
                        SemanticRelationshipField.relationship_id,
                        SemanticRelationshipField.sequence,
                    )
                )
            )
            if semantic_ids
            else []
        )
        mappings = (
            list(
                await self.session.scalars(
                    select(PolymorphicRelationshipMapping).where(
                        PolymorphicRelationshipMapping.polymorphic_relationship_id.in_(
                            polymorphic_ids
                        )
                    )
                )
            )
            if polymorphic_ids
            else []
        )
        physical_pairs: dict[uuid.UUID, list[RelationshipPair]] = {}
        for physical_field in physical_fields:
            physical_pairs.setdefault(physical_field.relationship_id, []).append(
                RelationshipPair(
                    physical_field.source_field_id,
                    physical_field.target_field_id,
                    physical_field.sequence,
                )
            )
        semantic_pairs: dict[uuid.UUID, list[RelationshipPair]] = {}
        for semantic_field in semantic_fields:
            semantic_pairs.setdefault(semantic_field.relationship_id, []).append(
                RelationshipPair(
                    semantic_field.source_field_id,
                    semantic_field.target_field_id,
                    semantic_field.sequence,
                )
            )
        relationships: dict[uuid.UUID, CatalogRelationship] = {
            item.id: CatalogRelationship(
                item.id,
                "physical",
                item.source_entity_id,
                item.target_entity_id,
                item.is_active,
                tuple(physical_pairs.get(item.id, [])),
            )
            for item in physical
        }
        relationships.update(
            {
                item.id: CatalogRelationship(
                    item.id,
                    "semantic",
                    item.source_entity_id,
                    item.target_entity_id,
                    item.status == "confirmed" and item.is_enabled and item.invalid_reason is None,
                    tuple(semantic_pairs.get(item.id, [])),
                )
                for item in semantic
                if item.target_entity_id is not None
            }
        )
        return CatalogSnapshot(
            entities={
                item.id: CatalogEntity(
                    item.id, item.schema_name, item.physical_name, item.is_active
                )
                for item in entities
            },
            fields={
                item.id: CatalogField(
                    item.id,
                    item.entity_id,
                    item.physical_name,
                    item.normalized_data_type,
                    item.is_active,
                )
                for item in fields
            },
            relationships=relationships,
            polymorphic_relationships={
                item.id: PolymorphicRelationshipSnapshot(
                    item.id,
                    item.source_entity_id,
                    item.type_field_id,
                    item.id_field_id,
                    item.status == "confirmed" and item.is_enabled and item.invalid_reason is None,
                )
                for item in polymorphic
            },
            polymorphic_mappings={
                item.id: PolymorphicMappingSnapshot(
                    item.id,
                    item.polymorphic_relationship_id,
                    item.type_value,
                    item.target_entity_id,
                    item.target_field_id,
                    item.is_enabled,
                )
                for item in mappings
            },
        )

    async def add(self, model: QueryCompilation) -> QueryCompilation:
        self.session.add(model)
        await self.session.flush()
        return model

    async def list_for_query(self, query_id: uuid.UUID) -> list[QueryCompilation]:
        return list(
            await self.session.scalars(
                select(QueryCompilation)
                .where(QueryCompilation.saved_query_id == query_id)
                .order_by(QueryCompilation.compiled_at.desc())
                .limit(50)
            )
        )

    async def get(self, compilation_id: uuid.UUID) -> QueryCompilation | None:
        return await self.session.get(QueryCompilation, compilation_id)
