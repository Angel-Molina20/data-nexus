import copy
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.queries import (
    ComplexityResponse,
    QueryIssueResponse,
    QueryValidationResponse,
    SavedQueryResponse,
)
from app.core.config import Settings
from app.db.models.database_connection import DatabaseConnection
from app.db.models.query import SavedQuery
from app.db.models.schema import SchemaPhysicalRelationship
from app.db.models.semantic import (
    PolymorphicRelationship,
    PolymorphicRelationshipMapping,
    SemanticRelationship,
)
from app.domain.connections.errors import PublicError
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import UniversalQuery
from app.domain.query_model.validation import (
    QueryValidationIssue,
    collect_references,
    validate_limits,
)
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.queries import SavedQueryRepository


@dataclass
class QueryContext:
    session: AsyncSession
    repository: SavedQueryRepository
    audit: AuditRepository
    settings: Settings


def issue_response(issue: QueryValidationIssue) -> QueryIssueResponse:
    return QueryIssueResponse(**issue.__dict__)


class ValidateUniversalQueryService:
    def __init__(self, context: QueryContext) -> None:
        self.context = context

    async def execute(
        self, query: UniversalQuery, permissions: set[str]
    ) -> QueryValidationResponse:
        refs, issues = collect_references(query)
        issues.extend(validate_limits(query, self.context.settings))
        connection = await self.context.session.get(DatabaseConnection, query.connection_id)
        capabilities: list[str] = []
        complexity = calculate_complexity(query)
        if complexity.metrics["joins"]:
            capabilities.append("supports_joins")
        if complexity.metrics["subqueries"]:
            capabilities.append("supports_subqueries")
        if complexity.metrics["unions"]:
            capabilities.append("supports_union")
        if connection is None:
            issues.append(
                QueryValidationIssue(
                    "QUERY_SOURCE_NOT_FOUND", "La conexión no existe.", "error", "connection_id"
                )
            )
        else:
            for capability in capabilities:
                if not connection.capabilities_json.get(capability, False):
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_CAPABILITY_NOT_SUPPORTED",
                            f"La fuente no soporta {capability}.",
                            "error",
                            "query",
                            details={"capability": capability},
                        )
                    )
        (
            entities,
            fields,
            semantic_entities,
            semantic_fields,
        ) = await self.context.repository.catalog(query.connection_id)
        for entity_id in refs.entities:
            entity = entities.get(entity_id)
            semantic_entity = semantic_entities.get(entity_id)
            if entity is None:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_SOURCE_NOT_FOUND",
                        "La entidad no existe en el catálogo.",
                        "error",
                        "query.source",
                    )
                )
            elif not entity.is_active and not query.options.allow_inactive_metadata:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_SOURCE_NOT_FOUND",
                        "La entidad está inactiva.",
                        "error",
                        "query.source",
                    )
                )
            elif semantic_entity is not None and not semantic_entity.is_visible:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_FIELD_NOT_VISIBLE",
                        "La entidad no está visible en el catálogo semántico.",
                        "error",
                        "query.source",
                    )
                )
        for field_id in refs.fields:
            model = fields.get(field_id)
            semantic_field = semantic_fields.get(field_id)
            if model is None:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_FIELD_NOT_FOUND",
                        "El campo no existe en el catálogo.",
                        "error",
                        "query",
                    )
                )
            elif not model.is_active and not query.options.allow_inactive_metadata:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_FIELD_INACTIVE", "El campo está inactivo.", "error", "query"
                    )
                )
            elif semantic_field is not None and not semantic_field.is_visible:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_FIELD_NOT_VISIBLE", "El campo no está visible.", "error", "query"
                    )
                )
            elif semantic_field is not None and semantic_field.is_sensitive:
                code = (
                    "QUERY_SENSITIVE_FIELD_DENIED"
                    if "queries.use_sensitive_fields" not in permissions
                    else "QUERY_SENSITIVE_FIELD"
                )
                severity = "error" if code.endswith("DENIED") else "warning"
                issues.append(
                    QueryValidationIssue(
                        code, "La consulta referencia un campo sensible.", severity, "query"
                    )
                )
        for relationship_id in refs.relationships:
            physical = await self.context.session.get(SchemaPhysicalRelationship, relationship_id)
            semantic_relationship = await self.context.session.get(
                SemanticRelationship, relationship_id
            )
            polymorphic = await self.context.session.get(PolymorphicRelationship, relationship_id)
            if physical is not None and (
                not physical.is_active or physical.connection_id != query.connection_id
            ):
                issues.append(
                    QueryValidationIssue(
                        "QUERY_RELATIONSHIP_INVALID",
                        "La relación física no está disponible.",
                        "error",
                        "query.joins",
                    )
                )
            elif semantic_relationship is not None and (
                semantic_relationship.connection_id != query.connection_id
                or semantic_relationship.status != "confirmed"
                or not semantic_relationship.is_enabled
            ):
                issues.append(
                    QueryValidationIssue(
                        "QUERY_RELATIONSHIP_DISABLED",
                        "La relación lógica no está confirmada y habilitada.",
                        "error",
                        "query.joins",
                    )
                )
            elif polymorphic is not None:
                if polymorphic.connection_id != query.connection_id or not polymorphic.is_enabled:
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_POLYMORPHIC_RELATIONSHIP_INVALID",
                            "La relación polimórfica no está habilitada.",
                            "error",
                            "query.joins",
                        )
                    )
                elif not refs.mappings:
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_POLYMORPHIC_MAPPING_REQUIRED",
                            "El join polimórfico requiere un mapping.",
                            "error",
                            "query.joins",
                        )
                    )
            elif physical is None and semantic_relationship is None:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_RELATIONSHIP_NOT_FOUND",
                        "La relación no existe.",
                        "error",
                        "query.joins",
                    )
                )
        for mapping_id in refs.mappings:
            mapping = await self.context.session.get(PolymorphicRelationshipMapping, mapping_id)
            if mapping is None or not mapping.is_enabled:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_POLYMORPHIC_MAPPING_INVALID",
                        "El mapping polimórfico no existe o está deshabilitado.",
                        "error",
                        "query.joins",
                    )
                )
        errors = [issue_response(item) for item in issues if item.severity == "error"]
        warnings = [issue_response(item) for item in issues if item.severity == "warning"]
        if query.options.warnings_as_errors and warnings:
            errors.extend(warnings)
        return QueryValidationResponse(
            valid=not errors,
            errors=errors,
            warnings=warnings,
            capabilities_required=sorted(capabilities),
            referenced_entities=sorted(refs.entities, key=str),
            referenced_fields=sorted(refs.fields, key=str),
            referenced_relationships=sorted(refs.relationships, key=str),
            parameters=[item.parameter_id for item in query.parameters],
            complexity=ComplexityResponse(**complexity.__dict__),
            normalized_query=normalized_document(query),
            fingerprint=query_fingerprint(query),
        )


def saved_response(model: SavedQuery) -> SavedQueryResponse:
    return SavedQueryResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        connection_id=model.connection_id,
        owner_user_id=model.owner_user_id,
        document=model.query_document_json,
        schema_version=model.schema_version,
        status=model.status,
        validation_status=model.validation_status,
        validation_errors=model.validation_errors_json,
        validation_warnings=model.validation_warnings_json,
        fingerprint=model.fingerprint,
        complexity=model.complexity_json,
        revision=model.revision,
        last_validated_at=model.last_validated_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SavedQueryService:
    def __init__(self, context: QueryContext) -> None:
        self.context = context

    async def require(self, query_id: uuid.UUID, owner_id: uuid.UUID) -> SavedQuery:
        model = await self.context.repository.get(query_id)
        if model is None or model.owner_user_id != owner_id:
            raise PublicError("QUERY_NOT_FOUND", "La consulta no existe.", 404)
        return model

    async def create(
        self, name: str, description: str | None, document: UniversalQuery, owner_id: uuid.UUID
    ) -> SavedQueryResponse:
        model = SavedQuery(
            name=name,
            description=description,
            connection_id=document.connection_id,
            owner_user_id=owner_id,
            query_document_json=normalized_document(document),
            schema_version=document.schema_version,
            status="draft",
            validation_status="not_validated",
        )
        await self.context.repository.add(model)
        await self.context.audit.record(
            action="query.create",
            result="success",
            duration_ms=0,
            connection_id=document.connection_id,
            actor_user_id=owner_id,
            resource_type="saved_query",
            resource_id=str(model.id),
        )
        await self.context.session.commit()
        return saved_response(model)

    async def update(
        self,
        model: SavedQuery,
        revision: int,
        name: str | None,
        description: str | None,
        document: UniversalQuery | None,
    ) -> SavedQueryResponse:
        if model.revision != revision:
            raise PublicError(
                "QUERY_REVISION_CONFLICT", "La consulta fue modificada por otra sesión.", 409
            )
        changed = False
        if name is not None and name != model.name:
            model.name = name
            changed = True
        if description is not None and description != model.description:
            model.description = description
            changed = True
        if document is not None:
            if document.connection_id != model.connection_id:
                raise PublicError(
                    "QUERY_ACCESS_DENIED", "No se puede cambiar la conexión del borrador.", 403
                )
            normalized = normalized_document(document)
            if normalized != model.query_document_json:
                model.query_document_json = normalized
                model.validation_status = "not_validated"
                model.status = "draft"
                model.validation_errors_json = []
                model.validation_warnings_json = []
                model.fingerprint = None
                model.complexity_json = None
                model.last_validated_at = None
                changed = True
        if changed:
            model.revision += 1
            await self.context.session.commit()
        return saved_response(model)

    async def validate(self, model: SavedQuery, permissions: set[str]) -> QueryValidationResponse:
        try:
            document = UniversalQuery.model_validate(model.query_document_json)
        except ValidationError as error:
            raise PublicError(
                "QUERY_SCHEMA_INVALID", "El documento de consulta no es válido.", 422
            ) from error
        result = await ValidateUniversalQueryService(self.context).execute(document, permissions)
        model.validation_status = "valid" if result.valid else "invalid"
        model.status = "valid" if result.valid else "invalid"
        model.validation_errors_json = [item.model_dump(mode="json") for item in result.errors]
        model.validation_warnings_json = [item.model_dump(mode="json") for item in result.warnings]
        model.fingerprint = result.fingerprint
        model.complexity_json = result.complexity.model_dump(mode="json")
        model.last_validated_at = datetime.now(UTC)
        model.revision += 1
        await self.context.session.commit()
        return result

    async def duplicate(self, model: SavedQuery, owner_id: uuid.UUID) -> SavedQueryResponse:
        duplicate = SavedQuery(
            name=f"{model.name} (copia)",
            description=model.description,
            connection_id=model.connection_id,
            owner_user_id=owner_id,
            query_document_json=copy.deepcopy(model.query_document_json),
            schema_version=model.schema_version,
            status="draft",
            validation_status="not_validated",
        )
        await self.context.repository.add(duplicate)
        await self.context.session.commit()
        return saved_response(duplicate)
