import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import ConnectionContextDependency
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

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(
    request: ConnectionTestRequest, context: ConnectionContextDependency
) -> ConnectionTestResponse:
    return await TestConnectionService(context).execute(request)


@router.post("", response_model=ConnectionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    request: ConnectionCreateRequest, context: ConnectionContextDependency
) -> ConnectionDetailResponse:
    return await CreateConnectionService(context).execute(request)


@router.get("", response_model=ConnectionListResponse)
async def list_connections(
    context: ConnectionContextDependency,
    search: Annotated[str | None, Query(max_length=120)] = None,
    connection_status: Annotated[ConnectionStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ConnectionListResponse:
    return await ListConnectionsService(context).execute(
        search, connection_status.value if connection_status else None, page, page_size
    )


@router.get("/{connection_id}", response_model=ConnectionDetailResponse)
async def get_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> ConnectionDetailResponse:
    return await GetConnectionService(context).execute(connection_id)


@router.patch("/{connection_id}", response_model=ConnectionDetailResponse)
async def update_connection(
    connection_id: uuid.UUID,
    request: ConnectionUpdateRequest,
    context: ConnectionContextDependency,
) -> ConnectionDetailResponse:
    return await UpdateConnectionService(context).execute(connection_id, request)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> Response:
    await DeleteConnectionService(context).execute(connection_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{connection_id}/test", response_model=ConnectionTestResponse)
async def retest_connection(
    connection_id: uuid.UUID, context: ConnectionContextDependency
) -> ConnectionTestResponse:
    return await RetestConnectionService(context).execute(connection_id)
