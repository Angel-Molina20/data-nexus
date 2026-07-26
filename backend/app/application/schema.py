import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

from anyio import fail_after, to_thread
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.schema import (
    ChangeListResponse,
    ChangeResponse,
    EntityDetailResponse,
    EntityListResponse,
    EntitySummaryResponse,
    FieldResponse,
    IndexFieldResponse,
    IndexResponse,
    RelationshipFieldResponse,
    RelationshipListResponse,
    RelationshipResponse,
    SchemaSummaryResponse,
    SynchronizationListResponse,
    SynchronizationResponse,
)
from app.core.config import Settings
from app.db.models.database_connection import DatabaseConnection
from app.db.models.schema import SchemaPhysicalRelationship, SchemaSynchronization
from app.domain.connections.errors import PublicError
from app.domain.connections.models import ConnectionParameters, Engine
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.network.policy import DatabaseHostPolicy
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.repositories.schema import SchemaRepository
from app.infrastructure.security.encryption import CredentialEncryption


@dataclass(slots=True)
class SchemaContext:
    session: AsyncSession
    connections: DatabaseConnectionRepository
    schemas: SchemaRepository
    audit: AuditRepository
    adapters: AdapterRegistry
    encryption: CredentialEncryption
    host_policy: DatabaseHostPolicy
    settings: Settings


class SynchronizeSchemaService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> SynchronizationResponse:
        connection = await _require_connection(self.context, connection_id)
        if not await self.context.schemas.try_lock(connection_id):
            raise PublicError(
                "SCHEMA_SYNC_IN_PROGRESS",
                "Ya existe una sincronización en curso para esta conexión.",
                409,
            )
        synchronization: SchemaSynchronization | None = None
        started = time.monotonic()
        try:
            synchronization = await self.context.schemas.create_synchronization(
                connection_id
            )
            await self.context.audit.record(
                action="schema.synchronize.started",
                result="success",
                duration_ms=0,
                connection_id=connection_id,
            )
            await self.context.session.commit()
            parameters = _connection_parameters(self.context, connection)
            self.context.host_policy.validate(parameters.host, parameters.port)
            adapter = self.context.adapters.create(Engine(connection.engine), parameters)
            try:
                try:
                    with fail_after(self.context.settings.SCHEMA_SYNC_TIMEOUT_SECONDS):
                        inspected = await to_thread.run_sync(
                            lambda: adapter.inspect_schema(
                                include_views=self.context.settings.SCHEMA_SYNC_INCLUDE_VIEWS,
                                max_entities=self.context.settings.SCHEMA_SYNC_MAX_ENTITIES,
                                include_system_schemas=(
                                    self.context.settings.SCHEMA_SYNC_INCLUDE_SYSTEM_SCHEMAS
                                ),
                            ),
                            abandon_on_cancel=True,
                        )
                except TimeoutError as error:
                    raise PublicError(
                        "SCHEMA_SYNC_TIMEOUT",
                        "La sincronización excedió el tiempo máximo permitido.",
                        504,
                    ) from error
            finally:
                await to_thread.run_sync(adapter.close)
            synchronization = await self.context.schemas.get_synchronization(
                connection_id, synchronization.id
            )
            if synchronization is None:
                raise PublicError(
                    "SCHEMA_SYNC_FAILED", "No fue posible guardar la sincronización.", 500
                )
            counters = await self.context.schemas.apply(
                connection_id, synchronization, inspected
            )
            synchronization.status = (
                "completed_with_warnings" if inspected.warnings else "completed"
            )
            synchronization.finished_at = datetime.now(UTC)
            synchronization.duration_ms = int((time.monotonic() - started) * 1000)
            synchronization.entities_discovered = len(inspected.entities)
            synchronization.fields_discovered = sum(
                len(entity.fields) for entity in inspected.entities
            )
            synchronization.indexes_discovered = sum(
                len(entity.indexes) for entity in inspected.entities
            )
            synchronization.relationships_discovered = len(inspected.relationships)
            synchronization.warnings_json = inspected.warnings
            for key, value in counters.items():
                setattr(synchronization, key, value)
            await self.context.audit.record(
                action="schema.synchronize.completed",
                result="success",
                duration_ms=synchronization.duration_ms,
                connection_id=connection_id,
            )
            await self.context.session.commit()
            await self.context.session.refresh(synchronization)
            return synchronization_response(synchronization)
        except PublicError as error:
            await self.context.session.rollback()
            if synchronization is not None:
                stored = await self.context.schemas.get_synchronization(
                    connection_id, synchronization.id
                )
                if stored is not None:
                    stored.status = "failed"
                    stored.finished_at = datetime.now(UTC)
                    stored.duration_ms = int((time.monotonic() - started) * 1000)
                    stored.error_code = error.code
                    stored.error_message = error.message
                    await self.context.audit.record(
                        action="schema.synchronize.failed",
                        result="error",
                        duration_ms=stored.duration_ms,
                        connection_id=connection_id,
                        error_code=error.code,
                    )
                    await self.context.session.commit()
            raise
        finally:
            await self.context.schemas.unlock(connection_id)
            await self.context.session.commit()


class GetSchemaSummaryService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> SchemaSummaryResponse:
        connection = await _require_connection(self.context, connection_id)
        latest = await self.context.schemas.latest_synchronization(connection_id)
        counts = await self.context.schemas.summary_counts(connection_id)
        return SchemaSummaryResponse(
            connection_id=connection_id,
            connection_name=connection.name,
            engine=connection.engine,
            raw_version=connection.raw_version,
            last_synchronized_at=latest.finished_at if latest else None,
            status=latest.status if latest else None,
            latest_added=(
                latest.entities_added + latest.fields_added if latest else 0
            ),
            latest_updated=(
                latest.entities_updated + latest.fields_updated if latest else 0
            ),
            latest_removed=(
                latest.entities_removed + latest.fields_removed if latest else 0
            ),
            warnings=latest.warnings_json if latest else [],
            **counts,
        )


class ListEntitiesService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        search: str | None,
        entity_type: str | None,
        is_active: bool | None,
        page: int,
        page_size: int,
    ) -> EntityListResponse:
        await _require_connection(self.context, connection_id)
        items, total = await self.context.schemas.list_entities(
            connection_id,
            search=search,
            entity_type=entity_type,
            is_active=is_active,
            page=page,
            page_size=page_size,
        )
        return EntityListResponse(
            items=[EntitySummaryResponse(**item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )


class GetEntityService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, entity_id: uuid.UUID
    ) -> EntityDetailResponse:
        entity = await self.context.schemas.get_entity(connection_id, entity_id)
        if entity is None:
            raise PublicError(
                "SCHEMA_ENTITY_NOT_FOUND", "La entidad solicitada no existe.", 404
            )
        fields = await self.context.schemas.entity_fields(entity_id)
        indexes = await self.context.schemas.entity_indexes(entity_id)
        relationships = await self.context.schemas.relationships(
            connection_id, entity_id
        )
        mapped_relationships = [_relationship_response(item) for item in relationships]
        return EntityDetailResponse(
            id=entity.id,
            connection_id=entity.connection_id,
            physical_name=entity.physical_name,
            display_name=entity.display_name,
            entity_type=entity.entity_type,
            engine=entity.engine,
            schema_name=entity.schema_name,
            comment=entity.comment,
            estimated_rows=entity.estimated_rows,
            storage_engine=entity.storage_engine,
            collation=entity.collation,
            is_active=entity.is_active,
            first_seen_at=entity.first_seen_at,
            last_seen_at=entity.last_seen_at,
            fields=[
                FieldResponse(
                    id=item.id,
                    physical_name=item.physical_name,
                    display_name=item.display_name,
                    ordinal_position=item.ordinal_position,
                    native_data_type=item.native_data_type,
                    normalized_data_type=item.normalized_data_type,
                    column_type=item.column_type,
                    is_nullable=item.is_nullable,
                    default_value=item.default_value,
                    is_primary_key=item.is_primary_key,
                    is_unique=item.is_unique,
                    is_auto_increment=item.is_auto_increment,
                    comment=item.comment,
                    is_active=item.is_active,
                )
                for item in fields
            ],
            indexes=[
                IndexResponse(
                    id=item["model"].id,
                    physical_name=item["model"].physical_name,
                    index_type=item["model"].index_type,
                    is_unique=item["model"].is_unique,
                    is_primary=item["model"].is_primary,
                    is_active=item["model"].is_active,
                    fields=[
                        IndexFieldResponse(
                            field_name=row[1],
                            sequence=row[0].sequence,
                            sort_direction=row[0].sort_direction,
                            prefix_length=row[0].prefix_length,
                        )
                        for row in item["fields"]
                    ],
                )
                for item in indexes
            ],
            incoming_relationships=[
                item for item in mapped_relationships if item.target_entity_id == entity_id
            ],
            outgoing_relationships=[
                item for item in mapped_relationships if item.source_entity_id == entity_id
            ],
        )


class ListRelationshipsService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> RelationshipListResponse:
        await _require_connection(self.context, connection_id)
        items = await self.context.schemas.relationships(connection_id)
        return RelationshipListResponse(
            items=[_relationship_response(item) for item in items],
            total=len(items),
        )


class ListSynchronizationsService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, page: int, page_size: int
    ) -> SynchronizationListResponse:
        await _require_connection(self.context, connection_id)
        items, total = await self.context.schemas.list_synchronizations(
            connection_id, page, page_size
        )
        return SynchronizationListResponse(
            items=[synchronization_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )


class GetSynchronizationService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, synchronization_id: uuid.UUID
    ) -> SynchronizationResponse:
        item = await self.context.schemas.get_synchronization(
            connection_id, synchronization_id
        )
        if item is None:
            raise PublicError(
                "RESOURCE_NOT_FOUND", "La sincronización solicitada no existe.", 404
            )
        return synchronization_response(item)


class ListChangesService:
    def __init__(self, context: SchemaContext) -> None:
        self.context = context

    async def execute(
        self,
        connection_id: uuid.UUID,
        synchronization_id: uuid.UUID | None,
        change_type: str | None,
        object_type: str | None,
        page: int,
        page_size: int,
    ) -> ChangeListResponse:
        await _require_connection(self.context, connection_id)
        items, total = await self.context.schemas.list_changes(
            connection_id,
            synchronization_id,
            change_type,
            object_type,
            page,
            page_size,
        )
        return ChangeListResponse(
            items=[
                ChangeResponse(
                    id=item.id,
                    synchronization_id=item.synchronization_id,
                    change_type=item.change_type,
                    object_type=item.object_type,
                    object_id=item.object_id,
                    physical_name=item.physical_name,
                    previous_value=item.previous_value_json,
                    current_value=item.current_value_json,
                    created_at=item.created_at,
                )
                for item in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )


async def _require_connection(
    context: SchemaContext, connection_id: uuid.UUID
) -> DatabaseConnection:
    connection = await context.connections.get(connection_id)
    if connection is None:
        raise PublicError(
            "RESOURCE_NOT_FOUND", "La conexión solicitada no existe.", 404
        )
    return connection


def _connection_parameters(
    context: SchemaContext, connection: DatabaseConnection
) -> ConnectionParameters:
    return ConnectionParameters(
        host=connection.host,
        port=connection.port,
        database_name=connection.database_name,
        username=connection.username,
        password=context.encryption.decrypt_secret(connection.encrypted_password),
        ssl_enabled=connection.ssl_enabled,
        configuration=connection.configuration_json,
    )


def synchronization_response(
    item: SchemaSynchronization,
) -> SynchronizationResponse:
    return SynchronizationResponse(
        id=item.id,
        connection_id=item.connection_id,
        status=item.status,
        started_at=item.started_at,
        finished_at=item.finished_at,
        duration_ms=item.duration_ms,
        entities_discovered=item.entities_discovered,
        fields_discovered=item.fields_discovered,
        indexes_discovered=item.indexes_discovered,
        relationships_discovered=item.relationships_discovered,
        entities_added=item.entities_added,
        entities_updated=item.entities_updated,
        entities_removed=item.entities_removed,
        fields_added=item.fields_added,
        fields_updated=item.fields_updated,
        fields_removed=item.fields_removed,
        warnings=item.warnings_json,
        error_code=item.error_code,
        error_message=item.error_message,
    )


def _relationship_response(item: dict[str, object]) -> RelationshipResponse:
    model = cast(SchemaPhysicalRelationship, item["model"])
    rows = cast(list[tuple[Any, str, str]], item["fields"])
    return RelationshipResponse(
        id=model.id,
        constraint_name=model.constraint_name,
        source_entity_id=model.source_entity_id,
        source_entity=str(item["source_entity"]),
        target_entity_id=model.target_entity_id,
        target_entity=str(item["target_entity"]),
        update_rule=model.update_rule,
        delete_rule=model.delete_rule,
        is_active=model.is_active,
        fields=[
            RelationshipFieldResponse(
                source_field=str(row[1]),
                target_field=str(row[2]),
                sequence=row[0].sequence,
            )
            for row in rows
        ],
    )
