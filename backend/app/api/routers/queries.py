import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    QueryContextDependency,
    require_csrf,
    require_permission,
)
from app.api.schemas.queries import (
    ComplexityResponse,
    NormalizeResponse,
    QueryValidationResponse,
    SavedQueryCreateRequest,
    SavedQueryListResponse,
    SavedQueryResponse,
    SavedQueryUpdateRequest,
)
from app.application.auth import AuthorizationService
from app.application.queries import SavedQueryService, ValidateUniversalQueryService, saved_response
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import UniversalQuery

model_router = APIRouter(prefix="/query-model", tags=["query-model"])
queries_router = APIRouter(
    prefix="/queries", tags=["queries"], dependencies=[Depends(require_csrf)]
)


async def require_query_access(
    document: UniversalQuery, auth: AuthContextDependency, principal: CurrentPrincipal
) -> None:
    await AuthorizationService(auth.auth).require_connection_access(
        principal, document.connection_id, "analyst"
    )


@model_router.get("/schema", dependencies=[Depends(require_permission("queries.read"))])
async def query_schema(_: CurrentPrincipal) -> dict[str, Any]:
    return UniversalQuery.model_json_schema()


@model_router.post(
    "/validate",
    response_model=QueryValidationResponse,
    dependencies=[Depends(require_permission("queries.validate")), Depends(require_csrf)],
)
async def validate_query(
    document: UniversalQuery,
    context: QueryContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> QueryValidationResponse:
    await require_query_access(document, auth, principal)
    return await ValidateUniversalQueryService(context).execute(document, principal.permissions)


@model_router.post(
    "/normalize",
    response_model=NormalizeResponse,
    dependencies=[Depends(require_permission("queries.validate")), Depends(require_csrf)],
)
async def normalize_query(
    document: UniversalQuery, auth: AuthContextDependency, principal: CurrentPrincipal
) -> NormalizeResponse:
    await require_query_access(document, auth, principal)
    return NormalizeResponse(
        normalized_query=normalized_document(document), fingerprint=query_fingerprint(document)
    )


@model_router.post(
    "/complexity",
    response_model=ComplexityResponse,
    dependencies=[Depends(require_permission("queries.validate")), Depends(require_csrf)],
)
async def complexity(
    document: UniversalQuery, auth: AuthContextDependency, principal: CurrentPrincipal
) -> ComplexityResponse:
    await require_query_access(document, auth, principal)
    return ComplexityResponse(**calculate_complexity(document).__dict__)


@queries_router.get(
    "",
    response_model=SavedQueryListResponse,
    dependencies=[Depends(require_permission("queries.read"))],
)
async def list_queries(
    context: QueryContextDependency,
    principal: CurrentPrincipal,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> SavedQueryListResponse:
    items, total = await context.repository.list(principal.user.id, page=page, page_size=page_size)
    return SavedQueryListResponse(
        items=[saved_response(item) for item in items], total=total, page=page, page_size=page_size
    )


@queries_router.post(
    "",
    response_model=SavedQueryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("queries.create"))],
)
async def create_query(
    payload: SavedQueryCreateRequest,
    context: QueryContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> SavedQueryResponse:
    await require_query_access(payload.document, auth, principal)
    return await SavedQueryService(context).create(
        payload.name, payload.description, payload.document, principal.user.id
    )


@queries_router.get(
    "/{query_id}",
    response_model=SavedQueryResponse,
    dependencies=[Depends(require_permission("queries.read"))],
)
async def get_query(
    query_id: uuid.UUID, context: QueryContextDependency, principal: CurrentPrincipal
) -> SavedQueryResponse:
    return saved_response(await SavedQueryService(context).require(query_id, principal.user.id))


@queries_router.patch(
    "/{query_id}",
    response_model=SavedQueryResponse,
    dependencies=[Depends(require_permission("queries.update"))],
)
async def update_query(
    query_id: uuid.UUID,
    payload: SavedQueryUpdateRequest,
    context: QueryContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> SavedQueryResponse:
    model = await SavedQueryService(context).require(query_id, principal.user.id)
    if payload.document is not None:
        await require_query_access(payload.document, auth, principal)
    return await SavedQueryService(context).update(
        model, payload.revision, payload.name, payload.description, payload.document
    )


@queries_router.delete(
    "/{query_id}", status_code=204, dependencies=[Depends(require_permission("queries.delete"))]
)
async def delete_query(
    query_id: uuid.UUID, context: QueryContextDependency, principal: CurrentPrincipal
) -> Response:
    model = await SavedQueryService(context).require(query_id, principal.user.id)
    await context.session.delete(model)
    await context.session.commit()
    return Response(status_code=204)


@queries_router.post(
    "/{query_id}/validate",
    response_model=QueryValidationResponse,
    dependencies=[Depends(require_permission("queries.validate"))],
)
async def validate_saved_query(
    query_id: uuid.UUID,
    context: QueryContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> QueryValidationResponse:
    model = await SavedQueryService(context).require(query_id, principal.user.id)
    await AuthorizationService(auth.auth).require_connection_access(
        principal, model.connection_id, "analyst"
    )
    return await SavedQueryService(context).validate(model, principal.permissions)


@queries_router.post(
    "/{query_id}/duplicate",
    response_model=SavedQueryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("queries.create"))],
)
async def duplicate_query(
    query_id: uuid.UUID, context: QueryContextDependency, principal: CurrentPrincipal
) -> SavedQueryResponse:
    model = await SavedQueryService(context).require(query_id, principal.user.id)
    return await SavedQueryService(context).duplicate(model, principal.user.id)


@queries_router.post(
    "/{query_id}/archive",
    response_model=SavedQueryResponse,
    dependencies=[Depends(require_permission("queries.update"))],
)
async def archive_query(
    query_id: uuid.UUID, context: QueryContextDependency, principal: CurrentPrincipal
) -> SavedQueryResponse:
    model = await SavedQueryService(context).require(query_id, principal.user.id)
    model.status = "archived"
    model.archived_at = datetime.now(UTC)
    model.revision += 1
    await context.session.commit()
    return saved_response(model)
