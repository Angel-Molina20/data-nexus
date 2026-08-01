import uuid

from app.api.schemas.relationships import (
    SemanticEntityListResponse,
    SemanticEntityResponse,
    SemanticEntityUpdateRequest,
    SemanticFieldResponse,
    SemanticFieldUpdateRequest,
)
from app.application.relationships import RelationshipContext
from app.db.models.schema import SchemaEntity, SchemaField
from app.db.models.semantic import SemanticEntity, SemanticField
from app.domain.connections.errors import PublicError


class ListSemanticEntitiesService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> SemanticEntityListResponse:
        if await self.context.connections.get(connection_id) is None:
            raise PublicError("RESOURCE_NOT_FOUND", "La conexión no existe.", 404)
        items = [
            await _entity_response(self.context, entity, semantic, include_fields=False)
            for entity, semantic in await self.context.catalog.semantic_entities(connection_id)
        ]
        return SemanticEntityListResponse(items=items, total=len(items))


class GetSemanticEntityService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, entity_id: uuid.UUID
    ) -> SemanticEntityResponse:
        entity = await self.context.catalog.entity(connection_id, entity_id)
        if entity is None:
            raise PublicError("SEMANTIC_ENTITY_NOT_FOUND", "La entidad semántica no existe.", 404)
        semantic = await self.context.catalog.upsert_semantic_entity(connection_id, entity)
        await self.context.session.commit()
        return await _entity_response(self.context, entity, semantic, include_fields=True)


class UpdateSemanticEntityService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        entity_id: uuid.UUID,
        request: SemanticEntityUpdateRequest,
    ) -> SemanticEntityResponse:
        entity = await self.context.catalog.entity(connection_id, entity_id)
        if entity is None:
            raise PublicError("SEMANTIC_ENTITY_NOT_FOUND", "La entidad semántica no existe.", 404)
        semantic = await self.context.catalog.upsert_semantic_entity(connection_id, entity)
        for name, value in request.model_dump(exclude_unset=True).items():
            setattr(semantic, "tags_json" if name == "tags" else name, value)
        semantic.updated_by = "local-admin"
        await self.context.audit.record(
            action="semantic.entity.update",
            result="success",
            duration_ms=0,
            connection_id=connection_id,
        )
        await self.context.session.commit()
        return await _entity_response(self.context, entity, semantic, include_fields=True)


class UpdateSemanticFieldService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        field_id: uuid.UUID,
        request: SemanticFieldUpdateRequest,
    ) -> SemanticFieldResponse:
        result = await self.context.catalog.field(connection_id, field_id)
        if result is None:
            raise PublicError("SEMANTIC_FIELD_NOT_FOUND", "El campo semántico no existe.", 404)
        field, _ = result
        semantic = await self.context.catalog.upsert_semantic_field(field)
        for name, value in request.model_dump(exclude_unset=True).items():
            setattr(semantic, "tags_json" if name == "tags" else name, value)
        semantic.updated_by = "local-admin"
        await self.context.audit.record(
            action=(
                "semantic.field.sensitive"
                if request.is_sensitive is not None
                else "semantic.field.update"
            ),
            result="success",
            duration_ms=0,
            connection_id=connection_id,
        )
        await self.context.session.commit()
        return _field_response(field, semantic)


async def _entity_response(
    context: RelationshipContext,
    entity: SchemaEntity,
    semantic: SemanticEntity | None,
    *,
    include_fields: bool,
) -> SemanticEntityResponse:
    entity_id = entity.id
    fields = (
        await context.catalog.fields_by_ids(
            entity.connection_id,
            [
                field.id
                for catalog_entity in await context.catalog.catalog(entity.connection_id)
                if catalog_entity.id == entity_id
                for field in catalog_entity.fields
            ],
        )
        if include_fields
        else {}
    )
    configs = await context.catalog.semantic_field_configs(list(fields))
    sensitive = sum(item.is_sensitive for item in configs.values())
    return SemanticEntityResponse(
        id=entity_id,
        physical_name=entity.physical_name,
        display_name=(semantic.display_name if semantic else entity.display_name),
        singular_name=semantic.singular_name if semantic else None,
        plural_name=semantic.plural_name if semantic else None,
        description=semantic.description if semantic else None,
        business_domain=semantic.business_domain if semantic else None,
        tags=semantic.tags_json if semantic else [],
        is_visible=semantic.is_visible if semantic else True,
        is_active=entity.is_active,
        sensitive_fields=sensitive,
        fields=[
            _field_response(field, configs.get(field.id))
            for field in sorted(fields.values(), key=lambda item: item.ordinal_position)
        ],
        updated_at=semantic.updated_at if semantic else None,
    )


def _field_response(field: SchemaField, semantic: SemanticField | None) -> SemanticFieldResponse:
    return SemanticFieldResponse(
        id=field.id,
        physical_name=field.physical_name,
        display_name=(semantic.display_name if semantic else field.display_name),
        description=semantic.description if semantic else None,
        semantic_type=semantic.semantic_type if semantic else "unknown",
        format=semantic.format if semantic else None,
        tags=semantic.tags_json if semantic else [],
        is_visible=semantic.is_visible if semantic else True,
        is_sensitive=semantic.is_sensitive if semantic else False,
        is_active=field.is_active,
    )
