import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.dependencies import SchemaContextDependency
from app.api.schemas.schema import (
    ChangeListResponse,
    EntityDetailResponse,
    EntityListResponse,
    RelationshipListResponse,
    SchemaSummaryResponse,
    SynchronizationListResponse,
    SynchronizationResponse,
)
from app.application.schema import (
    GetEntityService,
    GetSchemaSummaryService,
    GetSynchronizationService,
    ListChangesService,
    ListEntitiesService,
    ListRelationshipsService,
    ListSynchronizationsService,
    SynchronizeSchemaService,
)

router = APIRouter(
    prefix="/connections/{connection_id}/schema",
    tags=["schema"],
)


@router.post("/synchronize", response_model=SynchronizationResponse)
async def synchronize_schema(
    connection_id: uuid.UUID, context: SchemaContextDependency
) -> SynchronizationResponse:
    return await SynchronizeSchemaService(context).execute(connection_id)


@router.get("/summary", response_model=SchemaSummaryResponse)
async def schema_summary(
    connection_id: uuid.UUID, context: SchemaContextDependency
) -> SchemaSummaryResponse:
    return await GetSchemaSummaryService(context).execute(connection_id)


@router.get("/entities", response_model=EntityListResponse)
async def list_entities(
    connection_id: uuid.UUID,
    context: SchemaContextDependency,
    search: Annotated[str | None, Query(max_length=255)] = None,
    entity_type: Literal["table", "view"] | None = None,
    is_active: bool | None = True,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> EntityListResponse:
    return await ListEntitiesService(context).execute(
        connection_id, search, entity_type, is_active, page, page_size
    )


@router.get("/entities/{entity_id}", response_model=EntityDetailResponse)
async def get_entity(
    connection_id: uuid.UUID,
    entity_id: uuid.UUID,
    context: SchemaContextDependency,
) -> EntityDetailResponse:
    return await GetEntityService(context).execute(connection_id, entity_id)


@router.get("/relationships", response_model=RelationshipListResponse)
async def list_relationships(
    connection_id: uuid.UUID, context: SchemaContextDependency
) -> RelationshipListResponse:
    return await ListRelationshipsService(context).execute(connection_id)


@router.get("/synchronizations", response_model=SynchronizationListResponse)
async def list_synchronizations(
    connection_id: uuid.UUID,
    context: SchemaContextDependency,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SynchronizationListResponse:
    return await ListSynchronizationsService(context).execute(
        connection_id, page, page_size
    )


@router.get(
    "/synchronizations/{synchronization_id}",
    response_model=SynchronizationResponse,
)
async def get_synchronization(
    connection_id: uuid.UUID,
    synchronization_id: uuid.UUID,
    context: SchemaContextDependency,
) -> SynchronizationResponse:
    return await GetSynchronizationService(context).execute(
        connection_id, synchronization_id
    )


@router.get("/changes", response_model=ChangeListResponse)
async def list_changes(
    connection_id: uuid.UUID,
    context: SchemaContextDependency,
    synchronization_id: uuid.UUID | None = None,
    change_type: Literal["added", "updated", "removed", "reactivated"] | None = None,
    object_type: Literal["entity", "field", "index", "relationship"] | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ChangeListResponse:
    return await ListChangesService(context).execute(
        connection_id,
        synchronization_id,
        change_type,
        object_type,
        page,
        page_size,
    )
