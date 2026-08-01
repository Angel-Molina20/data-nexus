import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.dependencies import (
    AuthContextDependency,
    ConnectionContextDependency,
    CurrentPrincipal,
    require_authenticated_request,
    require_connection_manager,
    require_connection_viewer,
    require_csrf,
    require_permission,
    require_sensitive_rate_limit,
)
from app.api.schemas.connections import (
    ConnectionCreateRequest,
    ConnectionDetailResponse,
    ConnectionListResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ConnectionUpdateRequest,
)
from app.application.connections import (
    CreateConnectionService,
    DeleteConnectionService,
    GetConnectionService,
    ListConnectionsService,
    RetestConnectionService,
    TestConnectionService,
    UpdateConnectionService,
)
from app.domain.connections.models import ConnectionStatus

router = APIRouter(
    prefix="/connections",
    tags=["connections"],
    dependencies=[
        Depends(require_authenticated_request),
        Depends(require_csrf),
        Depends(require_sensitive_rate_limit),
    ],
)


@router.post(
    "/test",
    response_model=ConnectionTestResponse,
    dependencies=[Depends(require_permission("connections.test"))],
)
async def test_connection(
    request: ConnectionTestRequest, context: ConnectionContextDependency
) -> ConnectionTestResponse:
    return await TestConnectionService(context).execute(request)


@router.post(
    "",
    response_model=ConnectionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("connections.create"))],
)
async def create_connection(
    request: ConnectionCreateRequest, context: ConnectionContextDependency
) -> ConnectionDetailResponse:
    return await CreateConnectionService(context).execute(request)


@router.get(
    "",
    response_model=ConnectionListResponse,
    dependencies=[Depends(require_permission("connections.read"))],
)
async def list_connections(
    context: ConnectionContextDependency,
    auth_context: AuthContextDependency,
    principal: CurrentPrincipal,
    search: Annotated[str | None, Query(max_length=120)] = None,
    connection_status: Annotated[ConnectionStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ConnectionListResponse:
    response = await ListConnectionsService(context).execute(
        search, connection_status.value if connection_status else None, page, page_size
    )
    if principal.user.is_superuser:
        return response
    allowed = await auth_context.auth.accessible_connection_ids(principal.user.id)
    response.items = [item for item in response.items if item.id in allowed]
    response.total = len(response.items)
    return response


@router.get(
    "/{connection_id}",
    response_model=ConnectionDetailResponse,
    dependencies=[
        Depends(require_permission("connections.read")),
        Depends(require_connection_viewer),
    ],
)
async def get_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> ConnectionDetailResponse:
    return await GetConnectionService(context).execute(connection_id)


@router.patch(
    "/{connection_id}",
    response_model=ConnectionDetailResponse,
    dependencies=[
        Depends(require_permission("connections.update")),
        Depends(require_connection_manager),
    ],
)
async def update_connection(
    connection_id: uuid.UUID,
    request: ConnectionUpdateRequest,
    context: ConnectionContextDependency,
) -> ConnectionDetailResponse:
    return await UpdateConnectionService(context).execute(connection_id, request)


@router.delete(
    "/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("connections.delete")),
        Depends(require_connection_manager),
    ],
)
async def delete_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> Response:
    await DeleteConnectionService(context).execute(connection_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{connection_id}/test",
    response_model=ConnectionTestResponse,
    dependencies=[
        Depends(require_permission("connections.test")),
        Depends(require_connection_manager),
    ],
)
async def retest_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> ConnectionTestResponse:
    return await RetestConnectionService(context).execute(connection_id)
