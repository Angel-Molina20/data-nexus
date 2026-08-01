import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import (
    RelationshipContextDependency,
    require_connection_manager,
    require_connection_viewer,
    require_csrf,
    require_permission,
)
from app.api.schemas.relationships import (
    SemanticEntityListResponse,
    SemanticEntityResponse,
    SemanticEntityUpdateRequest,
    SemanticFieldResponse,
    SemanticFieldUpdateRequest,
)
from app.application.semantic import (
    GetSemanticEntityService,
    ListSemanticEntitiesService,
    UpdateSemanticEntityService,
    UpdateSemanticFieldService,
)

router = APIRouter(
    prefix="/connections/{connection_id}/semantic",
    tags=["semantic-catalog"],
    dependencies=[
        Depends(require_connection_viewer),
        Depends(require_permission("semantic_catalog.read")),
        Depends(require_csrf),
    ],
)


@router.get("/entities", response_model=SemanticEntityListResponse)
async def list_semantic_entities(
    connection_id: uuid.UUID, context: RelationshipContextDependency
) -> SemanticEntityListResponse:
    return await ListSemanticEntitiesService(context).execute(connection_id)


@router.get("/entities/{entity_id}", response_model=SemanticEntityResponse)
async def get_semantic_entity(
    connection_id: uuid.UUID,
    entity_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> SemanticEntityResponse:
    return await GetSemanticEntityService(context).execute(connection_id, entity_id)


@router.patch(
    "/entities/{entity_id}",
    response_model=SemanticEntityResponse,
    dependencies=[
        Depends(require_permission("semantic_catalog.update")),
        Depends(require_connection_manager),
    ],
)
async def update_semantic_entity(
    connection_id: uuid.UUID,
    entity_id: uuid.UUID,
    request: SemanticEntityUpdateRequest,
    context: RelationshipContextDependency,
) -> SemanticEntityResponse:
    return await UpdateSemanticEntityService(context).execute(connection_id, entity_id, request)


@router.patch(
    "/fields/{field_id}",
    response_model=SemanticFieldResponse,
    dependencies=[
        Depends(require_permission("semantic_catalog.update")),
        Depends(require_connection_manager),
    ],
)
async def update_semantic_field(
    connection_id: uuid.UUID,
    field_id: uuid.UUID,
    request: SemanticFieldUpdateRequest,
    context: RelationshipContextDependency,
) -> SemanticFieldResponse:
    return await UpdateSemanticFieldService(context).execute(connection_id, field_id, request)
