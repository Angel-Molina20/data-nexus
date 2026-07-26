import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import RelationshipContextDependency
from app.api.schemas.relationships import (
    ConfirmCandidateRequest,
    DetectionResponse,
    ManualRelationshipRequest,
    PolymorphicMappingRequest,
    PolymorphicRelationshipRequest,
    PolymorphicRelationshipResponse,
    RelationshipGraphResponse,
    RelationshipListResponse,
    RelationshipUpdateRequest,
    UnifiedRelationshipResponse,
)
from app.application.relationships import (
    ConfirmCandidateService,
    CreateManualRelationshipService,
    DeleteRelationshipService,
    DetectRelationshipCandidatesService,
    ListRelationshipsService,
    PolymorphicRelationshipService,
    RejectCandidateService,
    RelationshipGraphService,
    SetRelationshipEnabledService,
    UpdateRelationshipService,
)
from app.domain.connections.errors import PublicError

router = APIRouter(
    prefix="/connections/{connection_id}/relationships",
    tags=["relationships"],
)


@router.get("", response_model=RelationshipListResponse)
async def list_relationships(
    connection_id: uuid.UUID,
    context: RelationshipContextDependency,
    relationship_type: Literal["physical", "inferred", "manual", "polymorphic"] | None = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> RelationshipListResponse:
    return await ListRelationshipsService(context).execute(
        connection_id,
        relationship_type=relationship_type,
        status=status_filter,
    )


@router.get("/graph", response_model=RelationshipGraphResponse)
async def relationship_graph(
    connection_id: uuid.UUID, context: RelationshipContextDependency
) -> RelationshipGraphResponse:
    return await RelationshipGraphService(context).execute(connection_id)


@router.get("/candidates", response_model=RelationshipListResponse)
async def list_candidates(
    connection_id: uuid.UUID, context: RelationshipContextDependency
) -> RelationshipListResponse:
    return await ListRelationshipsService(context).execute(connection_id, status="suggested")


@router.post("/detect", response_model=DetectionResponse)
async def detect_candidates(
    connection_id: uuid.UUID, context: RelationshipContextDependency
) -> DetectionResponse:
    return await DetectRelationshipCandidatesService(context).execute(connection_id)


@router.post(
    "/candidates/{candidate_id}/confirm",
    response_model=UnifiedRelationshipResponse,
)
async def confirm_candidate(
    connection_id: uuid.UUID,
    candidate_id: uuid.UUID,
    request: ConfirmCandidateRequest,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await ConfirmCandidateService(context).execute(connection_id, candidate_id, request)


@router.post(
    "/candidates/{candidate_id}/reject",
    response_model=UnifiedRelationshipResponse,
)
async def reject_candidate(
    connection_id: uuid.UUID,
    candidate_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await RejectCandidateService(context).execute(connection_id, candidate_id)


@router.post(
    "/manual",
    response_model=UnifiedRelationshipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manual_relationship(
    connection_id: uuid.UUID,
    request: ManualRelationshipRequest,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await CreateManualRelationshipService(context).execute(connection_id, request)


@router.post(
    "/polymorphic",
    response_model=PolymorphicRelationshipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_polymorphic_relationship(
    connection_id: uuid.UUID,
    request: PolymorphicRelationshipRequest,
    context: RelationshipContextDependency,
) -> PolymorphicRelationshipResponse:
    return await PolymorphicRelationshipService(context).create(connection_id, request)


@router.get(
    "/polymorphic/{relationship_id}",
    response_model=PolymorphicRelationshipResponse,
)
async def get_polymorphic_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> PolymorphicRelationshipResponse:
    return await PolymorphicRelationshipService(context).get(connection_id, relationship_id)


@router.patch(
    "/polymorphic/{relationship_id}",
    response_model=PolymorphicRelationshipResponse,
)
async def update_polymorphic_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    request: RelationshipUpdateRequest,
    context: RelationshipContextDependency,
) -> PolymorphicRelationshipResponse:
    relation = await context.catalog.polymorphic(connection_id, relationship_id)
    if relation is None:
        raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)
    for name, value in request.model_dump(exclude_unset=True).items():
        if name in {"display_name", "description"}:
            setattr(relation, name, value)
    await context.session.commit()
    return await PolymorphicRelationshipService(context).get(connection_id, relationship_id)


@router.delete("/polymorphic/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_polymorphic_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> Response:
    await PolymorphicRelationshipService(context).delete(connection_id, relationship_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/polymorphic/{relationship_id}/mappings",
    response_model=PolymorphicRelationshipResponse,
)
async def add_polymorphic_mapping(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    request: PolymorphicMappingRequest,
    context: RelationshipContextDependency,
) -> PolymorphicRelationshipResponse:
    return await PolymorphicRelationshipService(context).add_mapping(
        connection_id, relationship_id, request
    )


@router.patch(
    "/polymorphic/{relationship_id}/mappings/{mapping_id}",
    response_model=PolymorphicRelationshipResponse,
)
async def update_polymorphic_mapping(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    mapping_id: uuid.UUID,
    request: PolymorphicMappingRequest,
    context: RelationshipContextDependency,
) -> PolymorphicRelationshipResponse:
    return await PolymorphicRelationshipService(context).update_mapping(
        connection_id, relationship_id, mapping_id, request
    )


@router.delete(
    "/polymorphic/{relationship_id}/mappings/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_polymorphic_mapping(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    mapping_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> Response:
    await PolymorphicRelationshipService(context).delete_mapping(
        connection_id, relationship_id, mapping_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/polymorphic/{relationship_id}/discover-values")
async def discover_polymorphic_values(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> None:
    del connection_id, relationship_id
    if not context.settings.ENABLE_POLYMORPHIC_VALUE_DISCOVERY:
        raise PublicError(
            "POLYMORPHIC_DISCOVERY_DISABLED",
            "El descubrimiento de valores polimórficos está deshabilitado.",
            403,
        )
    raise PublicError(
        "POLYMORPHIC_DISCOVERY_DISABLED",
        "El descubrimiento remoto no está habilitado en esta fase.",
        501,
    )


@router.get("/{relationship_id}", response_model=UnifiedRelationshipResponse)
async def get_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    response = await ListRelationshipsService(context).execute(connection_id)
    for item in response.items:
        if item.id == relationship_id:
            return item
    raise PublicError("RELATIONSHIP_NOT_FOUND", "La relación no existe.", 404)


@router.patch("/{relationship_id}", response_model=UnifiedRelationshipResponse)
async def update_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    request: RelationshipUpdateRequest,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await UpdateRelationshipService(context).execute(connection_id, relationship_id, request)


@router.delete("/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> Response:
    await DeleteRelationshipService(context).execute(connection_id, relationship_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{relationship_id}/disable", response_model=UnifiedRelationshipResponse)
async def disable_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await SetRelationshipEnabledService(context).execute(
        connection_id, relationship_id, False
    )


@router.post("/{relationship_id}/enable", response_model=UnifiedRelationshipResponse)
async def enable_relationship(
    connection_id: uuid.UUID,
    relationship_id: uuid.UUID,
    context: RelationshipContextDependency,
) -> UnifiedRelationshipResponse:
    return await SetRelationshipEnabledService(context).execute(
        connection_id, relationship_id, True
    )
