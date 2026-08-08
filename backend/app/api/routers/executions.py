import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    ExecutionContextDependency,
    require_csrf,
    require_permission,
)
from app.api.schemas.executions import (
    CancelExecutionResponse,
    ExecutionHistoryResponse,
    ExecutionResponse,
    QueryExecutionRequest,
    QueryExecutionResultResponse,
)
from app.application.auth import AuthorizationService
from app.application.executions import QueryExecutionService
from app.application.query_execution.responses import execution_response, history_response
from app.domain.connections.errors import PublicError
from app.domain.query_execution.models import ExecutionStatus

router = APIRouter(prefix="/query-executions", tags=["query-executions"])


@router.post(
    "",
    response_model=QueryExecutionResultResponse,
    status_code=201,
    dependencies=[Depends(require_permission("queries.execute")), Depends(require_csrf)],
)
async def execute_query(
    payload: QueryExecutionRequest,
    context: ExecutionContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> QueryExecutionResultResponse:
    await AuthorizationService(auth.auth).require_connection_access(
        principal, payload.connection_id, "analyst"
    )
    return await QueryExecutionService(context).execute(
        payload, principal.permissions, principal.user.id
    )


@router.get(
    "",
    response_model=ExecutionHistoryResponse,
    dependencies=[Depends(require_permission("queries.execute"))],
)
async def list_executions(
    context: ExecutionContextDependency,
    principal: CurrentPrincipal,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    query_id: uuid.UUID | None = None,
    connection_id: uuid.UUID | None = None,
    status: str | None = None,
    started_from: datetime | None = None,
    started_to: datetime | None = None,
) -> ExecutionHistoryResponse:
    models = await context.executions.list_for_user(
        principal.user.id,
        limit=min(page_size, context.settings.QUERY_EXECUTION_HISTORY_LIMIT),
        offset=(page - 1) * page_size,
        query_id=query_id,
        connection_id=connection_id,
        status=status,
        started_from=started_from,
        started_to=started_to,
    )
    return history_response(models, page, page_size)


@router.get(
    "/{execution_id}",
    response_model=ExecutionResponse,
    dependencies=[Depends(require_permission("queries.execute"))],
)
async def get_execution(
    execution_id: uuid.UUID,
    context: ExecutionContextDependency,
    principal: CurrentPrincipal,
) -> ExecutionResponse:
    model = await context.executions.get_for_user(execution_id, principal.user.id)
    if model is None:
        raise PublicError("QUERY_EXECUTION_NOT_FOUND", "La ejecución no existe.", 404)
    return execution_response(model)


@router.post(
    "/{execution_id}/cancel",
    response_model=CancelExecutionResponse,
    dependencies=[Depends(require_permission("queries.execute")), Depends(require_csrf)],
)
async def cancel_execution(
    execution_id: uuid.UUID,
    context: ExecutionContextDependency,
    principal: CurrentPrincipal,
) -> CancelExecutionResponse:
    model = await context.executions.get_for_user(execution_id, principal.user.id)
    if model is None:
        raise PublicError("QUERY_EXECUTION_NOT_FOUND", "La ejecución no existe.", 404)
    supported = False
    if model.status in {ExecutionStatus.PENDING, ExecutionStatus.RUNNING}:
        supported = context.active.cancel(execution_id, principal.user.id)
        model.status = ExecutionStatus.CANCELLED
        model.finished_at = datetime.now().astimezone()
        model.error_code = "QUERY_EXECUTION_CANCELLED"
        model.error_message = "La ejecución fue cancelada."
        await context.session.commit()
    return CancelExecutionResponse(
        execution=execution_response(model), cancellation_supported=supported
    )
