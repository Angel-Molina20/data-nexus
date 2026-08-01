import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.relationships import (
    ConfirmCandidateRequest,
    DetectionResponse,
    GraphEdgeResponse,
    GraphNodeResponse,
    ManualRelationshipRequest,
    PolymorphicMappingRequest,
    PolymorphicMappingResponse,
    PolymorphicRelationshipRequest,
    PolymorphicRelationshipResponse,
    RelationshipEndpoint,
    RelationshipGraphResponse,
    RelationshipListResponse,
    RelationshipUpdateRequest,
    UnifiedRelationshipResponse,
)
from app.core.config import Settings
from app.db.models.schema import SchemaField
from app.db.models.semantic import (
    PolymorphicRelationship,
    PolymorphicRelationshipMapping,
    SemanticRelationship,
)
from app.domain.connections.errors import PublicError
from app.domain.relationships.models import CatalogField, TypeCompatibility
from app.domain.relationships.rules import (
    detect_bridge_candidates,
    detect_candidates,
    stable_fingerprint,
    validate_field_types,
)
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.repositories.semantic import SemanticCatalogRepository


@dataclass(slots=True)
class RelationshipContext:
    session: AsyncSession
    connections: DatabaseConnectionRepository
    catalog: SemanticCatalogRepository
    audit: AuditRepository
    settings: Settings


class DetectRelationshipCandidatesService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> DetectionResponse:
        await _require_connection(self.context, connection_id)
        if not self.context.settings.RELATIONSHIP_DETECTION_ENABLED:
            raise PublicError(
                "RELATIONSHIP_INVALID",
                "La detección de relaciones está deshabilitada.",
                400,
            )
        catalog = await self.context.catalog.catalog(connection_id)
        candidates = detect_candidates(
            connection_id,
            catalog,
            minimum_confidence=self.context.settings.RELATIONSHIP_MIN_CONFIDENCE,
            maximum_candidates=self.context.settings.RELATIONSHIP_MAX_CANDIDATES,
        )
        physical_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
        for physical in await self.context.catalog.physical_relationships(connection_id):
            for pair in await self.context.catalog.physical_fields(physical.id):
                physical_pairs.add((pair.source_field_id, pair.target_field_id))
        candidates = [
            candidate
            for candidate in candidates
            if candidate.relationship_type == "polymorphic"
            or not all(
                pair in physical_pairs
                for pair in zip(
                    candidate.source_field_ids,
                    candidate.target_field_ids,
                    strict=True,
                )
            )
        ]
        created, preserved = await self.context.catalog.store_candidates(connection_id, candidates)
        bridges = detect_bridge_candidates(catalog)
        await self.context.audit.record(
            action="relationship.detect",
            result="success",
            duration_ms=0,
            connection_id=connection_id,
        )
        await self.context.session.commit()
        return DetectionResponse(
            detected=len(candidates),
            created=created,
            preserved_rejections=preserved,
            polymorphic_candidates=sum(
                item.relationship_type == "polymorphic" for item in candidates
            ),
            bridge_candidates=bridges,
        )


class ListRelationshipsService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        *,
        status: str | None = None,
        relationship_type: str | None = None,
        include_suggested: bool = True,
    ) -> RelationshipListResponse:
        await _require_connection(self.context, connection_id)
        catalog = await self.context.catalog.catalog(connection_id)
        entities = {item.id: item for item in catalog}
        field_map = {field.id: field for entity in catalog for field in entity.fields}
        semantic_names = await self.context.catalog.semantic_names(connection_id)
        items: list[UnifiedRelationshipResponse] = []
        if relationship_type in {None, "physical"} and status in {None, "confirmed"}:
            for physical in await self.context.catalog.physical_relationships(connection_id):
                fields = await self.context.catalog.physical_fields(physical.id)
                source = entities.get(physical.source_entity_id)
                target = entities.get(physical.target_entity_id)
                if source is None or target is None:
                    continue
                items.append(
                    UnifiedRelationshipResponse(
                        id=physical.id,
                        type="physical",
                        status="confirmed" if physical.is_active else "invalid",
                        detection_source="foreign_key",
                        source=_endpoint(source, fields, field_map, semantic_names, True),
                        target=_endpoint(target, fields, field_map, semantic_names, False),
                        name=physical.constraint_name,
                        display_name=physical.constraint_name,
                        description="Clave foránea MySQL",
                        cardinality="many_to_one",
                        confidence=1,
                        conditions=[],
                        reasons=["Relación declarada físicamente en la fuente."],
                        warnings=[],
                        enabled=physical.is_active,
                        invalid_reason=(
                            None if physical.is_active else "La clave foránea ya no está activa."
                        ),
                    )
                )
        logical = await self.context.catalog.semantic_relationships(
            connection_id,
            status=status,
            relationship_type=relationship_type if relationship_type != "physical" else None,
        )
        for relation in logical:
            if relation.status == "suggested" and not include_suggested:
                continue
            if relationship_type == "physical":
                continue
            pairs = await self.context.catalog.relationship_fields(relation.id)
            source = entities.get(relation.source_entity_id)
            target = entities.get(relation.target_entity_id) if relation.target_entity_id else None
            if source is None:
                continue
            items.append(
                UnifiedRelationshipResponse(
                    id=relation.id,
                    type=relation.relationship_type,
                    status=relation.status,
                    detection_source=relation.detection_source,
                    source=_endpoint(source, pairs, field_map, semantic_names, True),
                    target=(
                        _endpoint(target, pairs, field_map, semantic_names, False)
                        if target
                        else None
                    ),
                    name=relation.name,
                    display_name=relation.display_name,
                    description=relation.description,
                    cardinality=relation.cardinality,
                    confidence=relation.confidence_score,
                    conditions=relation.conditions_json,
                    reasons=relation.reasons_json,
                    warnings=relation.warnings_json,
                    enabled=relation.is_enabled,
                    invalid_reason=relation.invalid_reason,
                    fingerprint=relation.fingerprint,
                )
            )
        polymorphic = await self.context.catalog.polymorphic_relationships(connection_id)
        if relationship_type in {None, "polymorphic"}:
            for polymorphic_relation in polymorphic:
                source = entities.get(polymorphic_relation.source_entity_id)
                if source is None:
                    continue
                type_field = field_map.get(polymorphic_relation.type_field_id)
                id_field = field_map.get(polymorphic_relation.id_field_id)
                if type_field is None or id_field is None:
                    continue
                items.append(
                    UnifiedRelationshipResponse(
                        id=polymorphic_relation.id,
                        type="polymorphic",
                        status=polymorphic_relation.status,
                        detection_source="administrator",
                        source=RelationshipEndpoint(
                            entity_id=source.id,
                            entity_name=source.physical_name,
                            display_name=_display_name(
                                source.id, source.physical_name, semantic_names
                            ),
                            fields=[type_field.physical_name, id_field.physical_name],
                        ),
                        target=None,
                        name=polymorphic_relation.name,
                        display_name=polymorphic_relation.display_name,
                        description=polymorphic_relation.description,
                        cardinality="many_to_one",
                        confidence=1,
                        conditions=[
                            {"kind": "discriminator", "field": type_field.physical_name},
                            {"kind": "identifier", "field": id_field.physical_name},
                        ],
                        reasons=["Relación polimórfica configurada por un administrador."],
                        warnings=[],
                        enabled=polymorphic_relation.is_enabled,
                        invalid_reason=polymorphic_relation.invalid_reason,
                    )
                )
        items.sort(key=lambda item: (item.type, item.source.entity_name, item.name))
        counts = {
            "physical": sum(item.type == "physical" for item in items),
            "confirmed": sum(
                item.status == "confirmed" and item.type != "physical" for item in items
            ),
            "suggested": sum(item.status == "suggested" for item in items),
            "polymorphic": sum(item.type == "polymorphic" for item in items),
            "invalid": sum(item.status == "invalid" for item in items),
        }
        return RelationshipListResponse(
            items=items,
            total=len(items),
            bridge_candidates=detect_bridge_candidates(catalog),
            **counts,
        )


class RelationshipGraphService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> RelationshipGraphResponse:
        catalog = await self.context.catalog.catalog(connection_id)
        names = await self.context.catalog.semantic_names(connection_id)
        all_fields = [field.id for entity in catalog for field in entity.fields]
        semantic_fields = await self.context.catalog.semantic_field_configs(all_fields)
        active_catalog = catalog[:200]
        relationships = await ListRelationshipsService(self.context).execute(
            connection_id, include_suggested=False
        )
        nodes = [
            GraphNodeResponse(
                id=entity.id,
                physical_name=entity.physical_name,
                display_name=_display_name(entity.id, entity.physical_name, names),
                entity_type=entity.entity_type,
                is_active=entity.is_active,
                key_fields=[
                    field.physical_name
                    for field in entity.fields
                    if field.is_primary_key or field.is_unique
                ][:5],
                sensitive_fields=sum(
                    bool(semantic_fields.get(field.id) and semantic_fields[field.id].is_sensitive)
                    for field in entity.fields
                ),
            )
            for entity in active_catalog
        ]
        node_ids = {item.id for item in nodes}
        edges = [
            GraphEdgeResponse(
                id=f"{item.type}:{item.id}",
                source=item.source.entity_id,
                target=item.target.entity_id,
                relationship_type=item.type,
                status=item.status,
                label=f"{item.type} · {item.status}",
            )
            for item in relationships.items
            if item.target
            and item.source.entity_id in node_ids
            and item.target.entity_id in node_ids
        ]
        return RelationshipGraphResponse(
            nodes=nodes, edges=edges, truncated=len(catalog) > len(active_catalog)
        )


class ConfirmCandidateService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        candidate_id: uuid.UUID,
        request: ConfirmCandidateRequest,
    ) -> UnifiedRelationshipResponse:
        relation = await _require_relationship(self.context, connection_id, candidate_id)
        if relation.status == "rejected":
            raise PublicError(
                "RELATIONSHIP_CANDIDATE_REJECTED",
                "La sugerencia ya fue rechazada.",
                409,
            )
        if relation.status != "suggested" or relation.relationship_type == "polymorphic":
            raise PublicError(
                "RELATIONSHIP_INVALID",
                "La sugerencia no puede confirmarse como relación simple.",
                400,
            )
        if request.target_entity_id is not None:
            relation.target_entity_id = request.target_entity_id
        existing = await self.context.catalog.relationship_fields(relation.id)
        source_ids = [item.source_field_id for item in existing]
        target_ids = request.target_field_ids or [item.target_field_id for item in existing]
        await _validate_pairs(
            self.context,
            connection_id,
            relation.source_entity_id,
            relation.target_entity_id,
            list(zip(source_ids, target_ids, strict=True)),
        )
        await self.context.catalog.replace_relationship_fields(
            relation.id, list(zip(source_ids, target_ids, strict=True))
        )
        if request.display_name:
            relation.display_name = request.display_name
        if request.description is not None:
            relation.description = request.description
        if request.cardinality:
            relation.cardinality = request.cardinality
        relation.status = "confirmed"
        relation.is_enabled = True
        relation.confirmed_at = datetime.now(UTC)
        relation.updated_by = "local-admin"
        await _audit_and_commit(self.context, connection_id, "relationship.confirm")
        return await _single_response(self.context, connection_id, relation.id)


class RejectCandidateService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, candidate_id: uuid.UUID
    ) -> UnifiedRelationshipResponse:
        relation = await _require_relationship(self.context, connection_id, candidate_id)
        if relation.status != "suggested":
            raise PublicError("RELATIONSHIP_INVALID", "La relación ya no es una sugerencia.", 409)
        relation.status = "rejected"
        relation.is_enabled = False
        relation.rejected_at = datetime.now(UTC)
        relation.updated_by = "local-admin"
        await _audit_and_commit(self.context, connection_id, "relationship.reject")
        return await _single_response(self.context, connection_id, relation.id)


class CreateManualRelationshipService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, request: ManualRelationshipRequest
    ) -> UnifiedRelationshipResponse:
        if (
            request.source_entity_id == request.target_entity_id
            and not request.confirm_self_relationship
        ):
            raise PublicError(
                "RELATIONSHIP_INVALID",
                "Una autorrelación requiere confirmación explícita.",
                400,
            )
        if len(request.fields) > self.context.settings.RELATIONSHIP_MAX_COMPOSITE_FIELDS:
            raise PublicError(
                "RELATIONSHIP_FIELD_COUNT_MISMATCH",
                "La relación supera el máximo de campos compuestos.",
                400,
            )
        pairs = [(item.source_field_id, item.target_field_id) for item in request.fields]
        await _validate_pairs(
            self.context,
            connection_id,
            request.source_entity_id,
            request.target_entity_id,
            pairs,
        )
        fingerprint = stable_fingerprint(
            connection_id=connection_id,
            relationship_type="manual",
            source_entity_id=request.source_entity_id,
            source_field_ids=[item[0] for item in pairs],
            target_entity_id=request.target_entity_id,
            target_field_ids=[item[1] for item in pairs],
            detection_source="administrator",
        )
        existing = await self.context.catalog.semantic_relationships(connection_id)
        if any(item.fingerprint == fingerprint for item in existing):
            raise PublicError("RELATIONSHIP_ALREADY_EXISTS", "La relación ya existe.", 409)
        relation = SemanticRelationship(
            connection_id=connection_id,
            relationship_type="manual",
            status="confirmed",
            detection_source="administrator",
            source_entity_id=request.source_entity_id,
            target_entity_id=request.target_entity_id,
            name=request.name,
            display_name=request.display_name,
            description=request.description,
            cardinality=request.cardinality,
            confidence_score=1,
            is_bidirectional=request.is_bidirectional,
            is_enabled=True,
            conditions_json=[],
            reasons_json=["Relación creada por un administrador."],
            warnings_json=[],
            fingerprint=fingerprint,
            confirmed_at=datetime.now(UTC),
            created_by="local-admin",
            updated_by="local-admin",
        )
        self.context.session.add(relation)
        await self.context.session.flush()
        await self.context.catalog.replace_relationship_fields(relation.id, pairs)
        await _audit_and_commit(self.context, connection_id, "relationship.manual.create")
        return await _single_response(self.context, connection_id, relation.id)


class UpdateRelationshipService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        relationship_id: uuid.UUID,
        request: RelationshipUpdateRequest,
    ) -> UnifiedRelationshipResponse:
        relation = await _require_relationship(self.context, connection_id, relationship_id)
        for name, value in request.model_dump(exclude_unset=True).items():
            setattr(relation, name, value)
        relation.updated_by = "local-admin"
        await _audit_and_commit(self.context, connection_id, "relationship.update")
        return await _single_response(self.context, connection_id, relationship_id)


class SetRelationshipEnabledService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, relationship_id: uuid.UUID, enabled: bool
    ) -> UnifiedRelationshipResponse:
        relation = await _require_relationship(self.context, connection_id, relationship_id)
        if enabled and relation.status == "invalid":
            raise PublicError(
                "RELATIONSHIP_INVALID",
                "Una relación inválida no puede habilitarse.",
                409,
            )
        relation.is_enabled = enabled
        relation.status = "confirmed" if enabled else "disabled"
        await _audit_and_commit(
            self.context,
            connection_id,
            "relationship.enable" if enabled else "relationship.disable",
        )
        return await _single_response(self.context, connection_id, relationship_id)


class DeleteRelationshipService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID, relationship_id: uuid.UUID) -> None:
        relation = await _require_relationship(self.context, connection_id, relationship_id)
        await self.context.catalog.delete_relationship(relation)
        await _audit_and_commit(self.context, connection_id, "relationship.delete")


class PolymorphicRelationshipService:
    def __init__(self, context: RelationshipContext) -> None:
        self.context = context

    async def create(
        self, connection_id: uuid.UUID, request: PolymorphicRelationshipRequest
    ) -> PolymorphicRelationshipResponse:
        if len(request.mappings) > self.context.settings.POLYMORPHIC_MAX_MAPPINGS:
            raise PublicError(
                "POLYMORPHIC_DISCOVERY_LIMIT_EXCEEDED",
                "La relación supera el máximo de mappings.",
                400,
            )
        await _validate_polymorphic_source(self.context, connection_id, request)
        existing = await self.context.catalog.polymorphic_by_fields(
            connection_id,
            request.source_entity_id,
            request.type_field_id,
            request.id_field_id,
        )
        if existing is not None:
            raise PublicError(
                "POLYMORPHIC_RELATIONSHIP_ALREADY_EXISTS",
                "Ya existe una relación polimórfica para esos campos.",
                409,
            )
        relation = PolymorphicRelationship(
            connection_id=connection_id,
            source_entity_id=request.source_entity_id,
            type_field_id=request.type_field_id,
            id_field_id=request.id_field_id,
            name=request.name,
            display_name=request.display_name,
            description=request.description,
            status="confirmed",
            is_enabled=True,
        )
        self.context.session.add(relation)
        try:
            await self.context.session.flush()
        except IntegrityError as error:
            await self.context.session.rollback()
            raise PublicError(
                "POLYMORPHIC_RELATIONSHIP_ALREADY_EXISTS",
                "Ya existe una relación polimórfica para esos campos.",
                409,
            ) from error
        for mapping in request.mappings:
            await self._add_mapping(connection_id, relation, mapping)
        await _audit_and_commit(self.context, connection_id, "relationship.polymorphic.create")
        return await self.get(connection_id, relation.id)

    async def get(
        self, connection_id: uuid.UUID, relationship_id: uuid.UUID
    ) -> PolymorphicRelationshipResponse:
        relation = await self.context.catalog.polymorphic(connection_id, relationship_id)
        if relation is None:
            raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)
        return await _polymorphic_response(self.context, relation)

    async def add_mapping(
        self,
        connection_id: uuid.UUID,
        relationship_id: uuid.UUID,
        request: PolymorphicMappingRequest,
    ) -> PolymorphicRelationshipResponse:
        relation = await self.context.catalog.polymorphic(connection_id, relationship_id)
        if relation is None:
            raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)
        mappings = await self.context.catalog.mappings(relation.id)
        if len(mappings) >= self.context.settings.POLYMORPHIC_MAX_MAPPINGS:
            raise PublicError(
                "POLYMORPHIC_DISCOVERY_LIMIT_EXCEEDED",
                "La relación alcanzó el máximo de mappings.",
                400,
            )
        await self._add_mapping(connection_id, relation, request)
        await _audit_and_commit(
            self.context,
            connection_id,
            "relationship.polymorphic.mapping.create",
        )
        return await self.get(connection_id, relationship_id)

    async def update_mapping(
        self,
        connection_id: uuid.UUID,
        relationship_id: uuid.UUID,
        mapping_id: uuid.UUID,
        request: PolymorphicMappingRequest,
    ) -> PolymorphicRelationshipResponse:
        relation = await self.context.catalog.polymorphic(connection_id, relationship_id)
        mapping = await self.context.catalog.mapping(relationship_id, mapping_id)
        if relation is None or mapping is None:
            raise PublicError("POLYMORPHIC_MAPPING_INVALID", "El mapping no existe.", 404)
        await _validate_mapping(self.context, connection_id, relation, request)
        for name, value in request.model_dump().items():
            setattr(mapping, name, value)
        await _audit_and_commit(
            self.context,
            connection_id,
            "relationship.polymorphic.mapping.update",
        )
        return await self.get(connection_id, relationship_id)

    async def delete_mapping(
        self, connection_id: uuid.UUID, relationship_id: uuid.UUID, mapping_id: uuid.UUID
    ) -> None:
        relation = await self.context.catalog.polymorphic(connection_id, relationship_id)
        mapping = await self.context.catalog.mapping(relationship_id, mapping_id)
        if relation is None or mapping is None:
            raise PublicError("POLYMORPHIC_MAPPING_INVALID", "El mapping no existe.", 404)
        await self.context.catalog.delete_mapping(mapping)
        await _audit_and_commit(
            self.context,
            connection_id,
            "relationship.polymorphic.mapping.delete",
        )

    async def delete(self, connection_id: uuid.UUID, relationship_id: uuid.UUID) -> None:
        relation = await self.context.catalog.polymorphic(connection_id, relationship_id)
        if relation is None:
            raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)
        await self.context.catalog.delete_polymorphic(relation)
        await _audit_and_commit(self.context, connection_id, "relationship.polymorphic.delete")

    async def _add_mapping(
        self,
        connection_id: uuid.UUID,
        relation: PolymorphicRelationship,
        request: PolymorphicMappingRequest,
    ) -> None:
        if any(
            item.type_value == request.type_value
            for item in await self.context.catalog.mappings(relation.id)
        ):
            raise PublicError(
                "POLYMORPHIC_MAPPING_DUPLICATE",
                "Ya existe un mapping para ese valor discriminador.",
                409,
            )
        await _validate_mapping(self.context, connection_id, relation, request)
        self.context.session.add(
            PolymorphicRelationshipMapping(
                polymorphic_relationship_id=relation.id,
                **request.model_dump(),
            )
        )


async def _require_connection(context: RelationshipContext, connection_id: uuid.UUID) -> None:
    if await context.connections.get(connection_id) is None:
        raise PublicError("RESOURCE_NOT_FOUND", "La conexión solicitada no existe.", 404)


async def _require_relationship(
    context: RelationshipContext,
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
) -> SemanticRelationship:
    relation = await context.catalog.relationship(connection_id, relationship_id)
    if relation is None:
        raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)
    return relation


def _catalog_field(field: SchemaField) -> CatalogField:
    return CatalogField(
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
    )


async def _validate_pairs(
    context: RelationshipContext,
    connection_id: uuid.UUID,
    source_entity_id: uuid.UUID,
    target_entity_id: uuid.UUID | None,
    pairs: list[tuple[uuid.UUID, uuid.UUID]],
) -> None:
    if target_entity_id is None:
        raise PublicError("RELATIONSHIP_INVALID", "Falta la entidad destino.", 400)
    source_entity = await context.catalog.entity(connection_id, source_entity_id)
    target_entity = await context.catalog.entity(connection_id, target_entity_id)
    if (
        not source_entity
        or not target_entity
        or not source_entity.is_active
        or not target_entity.is_active
    ):
        raise PublicError(
            "RELATIONSHIP_ENTITY_INACTIVE",
            "Las entidades deben existir y estar activas.",
            400,
        )
    fields = await context.catalog.fields_by_ids(
        connection_id, [item for pair in pairs for item in pair]
    )
    if len(fields) != len({item for pair in pairs for item in pair}):
        raise PublicError("RELATIONSHIP_FIELD_INACTIVE", "Uno o más campos no existen.", 400)
    for source_id, target_id in pairs:
        source = fields[source_id]
        target = fields[target_id]
        if source.entity_id != source_entity_id or target.entity_id != target_entity_id:
            raise PublicError(
                "RELATIONSHIP_INVALID",
                "Los campos no pertenecen a las entidades indicadas.",
                400,
            )
        if not source.is_active or not target.is_active:
            raise PublicError("RELATIONSHIP_FIELD_INACTIVE", "Los campos deben estar activos.", 400)
        compatibility = validate_field_types(_catalog_field(source), _catalog_field(target))
        if compatibility.status == TypeCompatibility.INCOMPATIBLE:
            raise PublicError(
                "RELATIONSHIP_TYPE_MISMATCH",
                "Los tipos de los campos no son compatibles.",
                400,
            )


async def _validate_polymorphic_source(
    context: RelationshipContext,
    connection_id: uuid.UUID,
    request: PolymorphicRelationshipRequest,
) -> None:
    entity = await context.catalog.entity(connection_id, request.source_entity_id)
    fields = await context.catalog.fields_by_ids(
        connection_id, [request.type_field_id, request.id_field_id]
    )
    if not entity or not entity.is_active or len(fields) != 2:
        raise PublicError(
            "POLYMORPHIC_MAPPING_INVALID",
            "La entidad o los campos polimórficos no son válidos.",
            400,
        )
    if any(field.entity_id != entity.id or not field.is_active for field in fields.values()):
        raise PublicError(
            "POLYMORPHIC_MAPPING_INVALID",
            "Ambos campos deben pertenecer a la entidad origen y estar activos.",
            400,
        )
    if fields[request.type_field_id].normalized_data_type not in {"string", "text", "enum"}:
        raise PublicError(
            "POLYMORPHIC_MAPPING_INVALID",
            "El discriminador debe ser un campo de texto.",
            400,
        )


async def _validate_mapping(
    context: RelationshipContext,
    connection_id: uuid.UUID,
    relation: PolymorphicRelationship,
    request: PolymorphicMappingRequest,
) -> None:
    target = await context.catalog.entity(connection_id, request.target_entity_id)
    fields = await context.catalog.fields_by_ids(
        connection_id, [relation.id_field_id, request.target_field_id]
    )
    if not target or not target.is_active or len(fields) != 2:
        raise PublicError("POLYMORPHIC_MAPPING_INVALID", "El destino no es válido.", 400)
    target_field = fields[request.target_field_id]
    if target_field.entity_id != target.id or not target_field.is_active:
        raise PublicError(
            "POLYMORPHIC_MAPPING_INVALID",
            "El campo destino no pertenece a la entidad indicada.",
            400,
        )
    compatibility = validate_field_types(
        _catalog_field(fields[relation.id_field_id]), _catalog_field(target_field)
    )
    if compatibility.status == TypeCompatibility.INCOMPATIBLE:
        raise PublicError(
            "RELATIONSHIP_TYPE_MISMATCH",
            "El identificador polimórfico no es compatible con el destino.",
            400,
        )


async def _single_response(
    context: RelationshipContext, connection_id: uuid.UUID, relationship_id: uuid.UUID
) -> UnifiedRelationshipResponse:
    items = await ListRelationshipsService(context).execute(connection_id)
    for item in items.items:
        if item.id == relationship_id:
            return item
    raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)


async def _audit_and_commit(
    context: RelationshipContext, connection_id: uuid.UUID, action: str
) -> None:
    await context.audit.record(
        action=action,
        result="success",
        duration_ms=0,
        connection_id=connection_id,
    )
    await context.session.commit()


def _display_name(entity_id: uuid.UUID, fallback: str, names: dict[uuid.UUID, Any]) -> str:
    item = names.get(entity_id)
    return str(item.display_name) if item else fallback


def _endpoint(
    entity: Any,
    pairs: list[Any],
    fields: dict[uuid.UUID, CatalogField],
    names: dict[uuid.UUID, Any],
    source: bool,
) -> RelationshipEndpoint:
    ids = [item.source_field_id if source else item.target_field_id for item in pairs]
    return RelationshipEndpoint(
        entity_id=entity.id,
        entity_name=entity.physical_name,
        display_name=_display_name(entity.id, entity.physical_name, names),
        fields=[fields[item].physical_name for item in ids if item in fields],
    )


async def _polymorphic_response(
    context: RelationshipContext, relation: PolymorphicRelationship
) -> PolymorphicRelationshipResponse:
    source = await context.catalog.entity(relation.connection_id, relation.source_entity_id)
    fields = await context.catalog.fields_by_ids(
        relation.connection_id, [relation.type_field_id, relation.id_field_id]
    )
    if source is None or len(fields) != 2:
        raise PublicError("POLYMORPHIC_MAPPING_INVALID", "La relación está incompleta.", 409)
    mappings = []
    for mapping in await context.catalog.mappings(relation.id):
        target = await context.catalog.entity(relation.connection_id, mapping.target_entity_id)
        target_field = await context.catalog.field(relation.connection_id, mapping.target_field_id)
        if target and target_field:
            mappings.append(
                PolymorphicMappingResponse(
                    id=mapping.id,
                    type_value=mapping.type_value,
                    target_entity_id=target.id,
                    target_entity=target.physical_name,
                    target_field_id=mapping.target_field_id,
                    target_field=target_field[0].physical_name,
                    display_name=mapping.display_name,
                    is_enabled=mapping.is_enabled,
                    conditions=[
                        (
                            f"{source.physical_name}."
                            f"{fields[relation.type_field_id].physical_name} "
                            f"= {mapping.type_value!r}"
                        ),
                        (
                            f"{source.physical_name}."
                            f"{fields[relation.id_field_id].physical_name} = "
                            f"{target.physical_name}."
                            f"{target_field[0].physical_name}"
                        ),
                    ],
                )
            )
    return PolymorphicRelationshipResponse(
        id=relation.id,
        source_entity_id=source.id,
        source_entity=source.physical_name,
        type_field_id=relation.type_field_id,
        type_field=fields[relation.type_field_id].physical_name,
        id_field_id=relation.id_field_id,
        id_field=fields[relation.id_field_id].physical_name,
        name=relation.name,
        display_name=relation.display_name,
        description=relation.description,
        status=relation.status,
        is_enabled=relation.is_enabled,
        invalid_reason=relation.invalid_reason,
        mappings=mappings,
    )
