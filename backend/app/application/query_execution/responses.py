import math

from app.api.schemas.executions import (
    ExecutionHistoryResponse,
    ExecutionResponse,
)
from app.db.models.execution import QueryExecution


def execution_response(model: QueryExecution) -> ExecutionResponse:
    total_pages = (
        math.ceil(model.total_rows / model.page_size)
        if model.total_rows is not None and model.page_size
        else None
    )
    return ExecutionResponse(
        id=model.id,
        connection_id=model.connection_id,
        query_id=model.query_id,
        query_revision=model.query_revision,
        status=model.status,
        started_at=model.started_at,
        finished_at=model.finished_at,
        duration_ms=model.duration_ms,
        row_count=model.row_count,
        returned_row_count=model.returned_row_count,
        truncated=model.truncated,
        page=model.page,
        page_size=model.page_size,
        total_rows=model.total_rows,
        total_pages=total_pages,
        error_code=model.error_code,
        error_message=model.error_message,
    )


def history_response(
    models: list[QueryExecution],
    page: int,
    page_size: int,
) -> ExecutionHistoryResponse:
    return ExecutionHistoryResponse(
        items=[execution_response(item) for item in models],
        page=page,
        page_size=page_size,
    )


def safe_execution_message(code: str) -> str:
    return {
        "QUERY_NOT_READ_ONLY": "Solo se permiten consultas de lectura.",
        "QUERY_EXECUTION_CANCELLED": "La ejecución fue cancelada.",
    }.get(code, "No fue posible ejecutar la consulta.")
