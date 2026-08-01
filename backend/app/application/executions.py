import asyncio
import copy
import math
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from datetime import time as time_value
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.executions import (
    ExecutionColumnResponse,
    ExecutionHistoryResponse,
    ExecutionMetadataResponse,
    ExecutionResponse,
    QueryExecutionRequest,
    QueryExecutionResultResponse,
)
from app.application.compilations import CompilerContext
from app.application.queries import SavedQueryService, ValidateUniversalQueryService
from app.core.config import Settings
from app.db.models.database_connection import DatabaseConnection
from app.db.models.execution import QueryExecution
from app.domain.connections.errors import PublicError
from app.domain.connections.models import ConnectionParameters, Engine
from app.domain.query_compiler.models import (
    CompilationConnection,
    CompilationContext,
    CompilationOptions,
    CompilationResult,
)
from app.domain.query_execution.models import ExecutionStatus
from app.domain.query_execution.policies import ensure_compiled_read_only
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import QueryParameterDefinition, UniversalQuery
from app.infrastructure.adapters.active_executions import ActiveExecutionRegistry
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.repositories.executions import QueryExecutionRepository
from app.infrastructure.security.encryption import CredentialEncryption


@dataclass
class ExecutionContext:
    session: AsyncSession
    executions: QueryExecutionRepository
    compiler: CompilerContext
    adapters: AdapterRegistry
    encryption: CredentialEncryption
    active: ActiveExecutionRegistry
    settings: Settings


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


class QueryExecutionService:
    def __init__(self, context: ExecutionContext) -> None:
        self.context = context

    async def execute(
        self, payload: QueryExecutionRequest, permissions: set[str], user_id: uuid.UUID
    ) -> QueryExecutionResultResponse:
        if payload.ast.connection_id != payload.connection_id:
            raise PublicError("QUERY_AST_INVALID", "El AST no corresponde a la conexión.", 400)
        if (
            self.context.active.active_for_user(user_id)
            >= self.context.settings.QUERY_EXECUTION_MAX_CONCURRENT_PER_USER
        ):
            raise PublicError(
                "QUERY_CONCURRENCY_LIMIT", "Alcanzaste el límite de ejecuciones activas.", 429
            )
        saved = None
        if payload.query_id:
            saved = await SavedQueryService(self.context.compiler.queries).require(
                payload.query_id, user_id
            )
            if saved.connection_id != payload.connection_id:
                raise PublicError(
                    "QUERY_AST_INVALID", "La consulta guardada usa otra conexión.", 400
                )
            if payload.query_revision is not None and payload.query_revision != saved.revision:
                raise PublicError(
                    "QUERY_REVISION_CONFLICT", "La revisión de la consulta cambió.", 409
                )
        validation = await ValidateUniversalQueryService(self.context.compiler.queries).execute(
            payload.ast, permissions
        )
        if not validation.valid:
            raise PublicError(
                "QUERY_AST_INVALID", "La consulta debe ser válida antes de ejecutarse.", 400
            )
        values = _resolve_parameters(payload.ast.parameters, payload.parameters)
        page_size = min(
            payload.pagination.page_size or self.context.settings.QUERY_EXECUTION_DEFAULT_PAGE_SIZE,
            self.context.settings.QUERY_EXECUTION_MAX_PAGE_SIZE,
        )
        page = payload.pagination.page
        connection = await self.context.session.get(DatabaseConnection, payload.connection_id)
        if connection is None:
            raise PublicError("QUERY_CONNECTION_UNAVAILABLE", "La conexión no existe.", 404)
        model = QueryExecution(
            id=payload.execution_id or uuid.uuid4(),
            user_id=user_id,
            connection_id=connection.id,
            query_id=payload.query_id,
            query_revision=payload.query_revision or (saved.revision if saved else None),
            status=ExecutionStatus.PENDING,
            page=page,
            page_size=page_size,
            database_engine=connection.engine,
            database_version=connection.raw_version,
            metadata_json={"query_fingerprint": query_fingerprint(payload.ast)},
        )
        await self.context.executions.add(model)
        await self.context.session.commit()
        await self.context.session.refresh(model)
        started = time.perf_counter()
        adapter = self.context.adapters.create(
            Engine(connection.engine),
            ConnectionParameters(
                host=connection.host,
                port=connection.port,
                database_name=connection.database_name,
                username=connection.username,
                password=self.context.encryption.decrypt_secret(connection.encrypted_password),
                ssl_enabled=connection.ssl_enabled,
                configuration=connection.configuration_json,
            ),
        )
        self.context.active.register(model.id, user_id, adapter)
        model.status = ExecutionStatus.RUNNING
        await self.context.session.commit()
        warnings: list[str] = []
        try:
            paged_document = _paginate(
                payload.ast, page, page_size, self.context.settings.QUERY_EXECUTION_MAX_ROWS
            )
            compiled = await self._compile(paged_document, connection, user_id, values)
            ensure_compiled_read_only(compiled.sql)
            async with asyncio.timeout(self.context.settings.QUERY_EXECUTION_TIMEOUT_SECONDS):
                result = await asyncio.to_thread(
                    adapter.execute_query,
                    compiled.sql,
                    compiled.parameters,
                    max_rows=min(page_size + 1, self.context.settings.QUERY_EXECUTION_MAX_ROWS),
                    max_response_bytes=self.context.settings.QUERY_EXECUTION_MAX_RESPONSE_BYTES,
                )
            rows = list(result.rows[:page_size])
            truncated = result.truncated or len(result.rows) > page_size
            total_rows: int | None = None
            if payload.options.include_total_count:
                if self.context.settings.QUERY_EXECUTION_ALLOW_TOTAL_COUNT:
                    total_rows = await self._count(
                        payload.ast, connection, user_id, values, adapter
                    )
                else:
                    warnings.append("El conteo total está deshabilitado por configuración.")
            model.status = ExecutionStatus.COMPLETED
            model.finished_at = datetime.now(UTC)
            model.duration_ms = round((time.perf_counter() - started) * 1000)
            model.row_count = len(rows)
            model.returned_row_count = len(rows)
            model.truncated = truncated
            model.total_rows = total_rows
            await self.context.session.commit()
            warnings.extend(result.warnings)
            include_sql = (
                payload.options.include_compiled_sql
                or self.context.settings.QUERY_EXECUTION_INCLUDE_SQL_BY_DEFAULT
            )
            return QueryExecutionResultResponse(
                execution=execution_response(model),
                columns=[ExecutionColumnResponse(**column.__dict__) for column in result.columns],
                rows=rows,
                warnings=warnings,
                metadata=ExecutionMetadataResponse(
                    database_engine=connection.engine,
                    database_version=connection.raw_version,
                    compiled_sql=compiled.sql if include_sql else None,
                ),
            )
        except TimeoutError as error:
            adapter.cancel_query()
            await self._fail(
                model,
                ExecutionStatus.TIMED_OUT,
                "QUERY_EXECUTION_TIMEOUT",
                "La ejecución excedió el tiempo permitido.",
                started,
            )
            raise PublicError(
                "QUERY_EXECUTION_TIMEOUT", "La ejecución excedió el tiempo permitido.", 504
            ) from error
        except PublicError as error:
            status = (
                ExecutionStatus.CANCELLED
                if error.code == "QUERY_EXECUTION_CANCELLED"
                else ExecutionStatus.FAILED
            )
            await self._fail(
                model, status, error.code, _safe_execution_message(error.code), started
            )
            raise PublicError(
                error.code, _safe_execution_message(error.code), error.status_code
            ) from error
        except Exception as error:
            await self._fail(
                model,
                ExecutionStatus.FAILED,
                "QUERY_EXECUTION_FAILED",
                "No fue posible ejecutar la consulta.",
                started,
            )
            raise PublicError(
                "QUERY_EXECUTION_FAILED", "No fue posible ejecutar la consulta.", 503
            ) from error
        finally:
            self.context.active.remove(model.id)
            await asyncio.to_thread(adapter.close)

    async def _compile(
        self,
        document: UniversalQuery,
        connection: DatabaseConnection,
        user_id: uuid.UUID,
        values: dict[str, object],
    ) -> CompilationResult:
        snapshot = await self.context.compiler.compilations.snapshot(connection.id)
        compiler = self.context.compiler.registry.create(connection.engine)
        context = CompilationContext(
            query=document,
            normalized_query=normalized_document(document),
            connection=CompilationConnection(
                connection.id,
                connection.engine,
                connection.provider,
                connection.raw_version,
                connection.major_version,
                connection.minor_version,
                dict(connection.capabilities_json),
            ),
            catalog=snapshot,
            current_user_id=user_id,
            options=CompilationOptions(
                mode="preview",
                preview_values=values,
                pretty=self.context.settings.QUERY_COMPILER_PRETTY_SQL,
                max_bound_parameters=self.context.settings.QUERY_MAX_BOUND_PARAMETERS,
            ),
            query_fingerprint=query_fingerprint(document),
            complexity=calculate_complexity(document),
        )
        return await asyncio.to_thread(compiler.compile, context)

    async def _count(
        self,
        document: UniversalQuery,
        connection: DatabaseConnection,
        user_id: uuid.UUID,
        values: dict[str, object],
        adapter: Any,
    ) -> int | None:
        base = copy.deepcopy(document)
        base.query.offset = None
        compiled = await self._compile(base, connection, user_id, values)
        base_sql = compiled.sql.rstrip().rstrip(";")
        count_sql = f"SELECT COUNT(*) AS datanexus_total FROM ({base_sql}) AS datanexus_count"
        ensure_compiled_read_only(count_sql)
        result = await asyncio.to_thread(
            adapter.execute_query,
            count_sql,
            compiled.parameters,
            max_rows=1,
            max_response_bytes=1024,
        )
        if not result.rows:
            return 0
        return int(next(iter(result.rows[0].values())))

    async def _fail(
        self,
        model: QueryExecution,
        status: ExecutionStatus,
        code: str,
        message: str,
        started: float,
    ) -> None:
        model.status = status
        model.finished_at = datetime.now(UTC)
        model.duration_ms = round((time.perf_counter() - started) * 1000)
        model.error_code = code
        model.error_message = message
        await self.context.session.commit()


def _paginate(document: UniversalQuery, page: int, page_size: int, max_rows: int) -> UniversalQuery:
    result = copy.deepcopy(document)
    logical_limit = result.query.limit
    window_offset = (page - 1) * page_size
    remaining = max_rows - window_offset
    if logical_limit is not None:
        remaining = min(remaining, max(0, logical_limit - window_offset))
    result.query.offset = (result.query.offset or 0) + window_offset
    result.query.limit = min(page_size + 1, max(0, remaining))
    return result


def _resolve_parameters(
    definitions: list[QueryParameterDefinition], supplied: dict[str, Any]
) -> dict[str, object]:
    declared = {item.parameter_id: item for item in definitions}
    unknown = set(supplied) - set(declared)
    if unknown:
        raise PublicError("QUERY_PARAMETER_UNKNOWN", "Se enviaron parámetros no declarados.", 400)
    result: dict[str, object] = {}
    for key, definition in declared.items():
        value = supplied.get(key, definition.default_value)
        if value is None:
            if definition.required and not definition.nullable:
                raise PublicError(
                    "QUERY_PARAMETER_MISSING", f"Falta el parámetro {definition.label}.", 400
                )
            result[key] = None
            continue
        try:
            result[key] = _coerce_parameter(definition, value)
        except (ValueError, TypeError, InvalidOperation) as error:
            raise PublicError(
                "QUERY_PARAMETER_INVALID", f"El parámetro {definition.label} no es válido.", 400
            ) from error
    return result


def _coerce_parameter(definition: QueryParameterDefinition, value: Any) -> object:
    data_type = definition.data_type
    if data_type == "string" or data_type == "enum" or data_type == "uuid":
        converted: object = str(value)
    elif data_type == "integer":
        if isinstance(value, bool):
            raise ValueError
        converted = int(value)
    elif data_type in {"decimal", "float"}:
        converted = Decimal(str(value)) if data_type == "decimal" else float(value)
    elif data_type == "boolean":
        if not isinstance(value, bool):
            raise ValueError
        converted = value
    elif data_type == "date":
        converted = date.fromisoformat(str(value))
    elif data_type == "time":
        converted = time_value.fromisoformat(str(value))
    elif data_type == "datetime":
        converted = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    elif data_type == "list":
        if not isinstance(value, list):
            raise ValueError
        converted = value
    else:
        converted = value
    if definition.allowed_values is not None and converted not in definition.allowed_values:
        raise ValueError
    return converted


def _safe_execution_message(code: str) -> str:
    return {
        "QUERY_NOT_READ_ONLY": "Solo se permiten consultas de lectura.",
        "QUERY_EXECUTION_CANCELLED": "La ejecución fue cancelada.",
    }.get(code, "No fue posible ejecutar la consulta.")


def history_response(
    models: list[QueryExecution], page: int, page_size: int
) -> ExecutionHistoryResponse:
    return ExecutionHistoryResponse(
        items=[execution_response(item) for item in models], page=page, page_size=page_size
    )
