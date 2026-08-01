import asyncio
import time
import uuid
from dataclasses import asdict, dataclass

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.compilations import (
    CompilationHistoryItem,
    CompilationHistoryResponse,
    CompilationMessageResponse,
    CompilationResponse,
    CompilerCapabilitiesResponse,
    ParameterMetadataResponse,
)
from app.api.schemas.queries import ComplexityResponse
from app.application.queries import QueryContext, ValidateUniversalQueryService
from app.core.config import Settings
from app.db.models.database_connection import DatabaseConnection
from app.db.models.query import QueryCompilation, SavedQuery
from app.domain.connections.errors import PublicError
from app.domain.query_compiler.compiler import MySQLQueryCompiler
from app.domain.query_compiler.models import (
    COMPILER_VERSION,
    CompilationConnection,
    CompilationContext,
    CompilationOptions,
    CompilationResult,
)
from app.domain.query_compiler.registry import QueryCompilerRegistry
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import UniversalQuery
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.compilations import CompilationRepository


@dataclass
class CompilerContext:
    session: AsyncSession
    compilations: CompilationRepository
    queries: QueryContext
    audit: AuditRepository
    settings: Settings
    registry: QueryCompilerRegistry


def compilation_response(
    result: CompilationResult, compilation_id: uuid.UUID | None = None
) -> CompilationResponse:
    return CompilationResponse(
        id=compilation_id,
        success=result.success,
        engine=result.engine,
        provider=result.provider,
        server_version=result.server_version,
        dialect=result.dialect,
        compiler_version=result.compiler_version,
        sql=result.sql,
        parameters={
            key: ParameterMetadataResponse(
                source=value.source,
                data_type=value.data_type,
                sensitive=value.sensitive,
                parameter_id=value.parameter_id,
                has_value=value.has_value and not value.sensitive,
            )
            for key, value in result.parameter_metadata.items()
        },
        warnings=[CompilationMessageResponse(**asdict(item)) for item in result.warnings],
        errors=[CompilationMessageResponse(**asdict(item)) for item in result.errors],
        capabilities_used=list(result.capabilities_used),
        referenced_entities=list(result.referenced_entities),
        referenced_fields=list(result.referenced_fields),
        referenced_relationships=list(result.referenced_relationships),
        query_fingerprint=result.query_fingerprint,
        compilation_fingerprint=result.compilation_fingerprint,
        complexity=ComplexityResponse(**asdict(result.complexity)),
        executed=False,
    )


class CompileUniversalQueryService:
    def __init__(self, context: CompilerContext) -> None:
        self.context = context

    async def execute(
        self,
        document: UniversalQuery,
        permissions: set[str],
        user_id: uuid.UUID,
        *,
        mode: str = "definition",
        preview_values: dict[str, object] | None = None,
        saved_query: SavedQuery | None = None,
    ) -> CompilationResponse:
        validation = await ValidateUniversalQueryService(self.context.queries).execute(
            document, permissions
        )
        if not validation.valid:
            raise PublicError(
                "QUERY_SCHEMA_INVALID", "La consulta debe ser válida antes de compilarse.", 422
            )
        connection = await self.context.session.get(DatabaseConnection, document.connection_id)
        if connection is None:
            raise PublicError("QUERY_SOURCE_NOT_FOUND", "La conexión no existe.", 404)
        snapshot = await self.context.compilations.snapshot(connection.id)
        compiler = self.context.registry.create(connection.engine)
        started = time.perf_counter()
        compilation_context = CompilationContext(
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
                mode="preview" if mode == "preview" else "definition",
                preview_values=preview_values or {},
                pretty=self.context.settings.QUERY_COMPILER_PRETTY_SQL,
                max_bound_parameters=self.context.settings.QUERY_MAX_BOUND_PARAMETERS,
            ),
            query_fingerprint=query_fingerprint(document),
            complexity=calculate_complexity(document),
        )
        try:
            async with asyncio.timeout(self.context.settings.QUERY_COMPILATION_TIMEOUT_SECONDS):
                result = await asyncio.to_thread(compiler.compile, compilation_context)
        except TimeoutError as error:
            raise PublicError(
                "QUERY_COMPILATION_FAILED", "La compilación excedió el tiempo permitido.", 408
            ) from error
        duration_ms = round((time.perf_counter() - started) * 1000)
        if len(result.sql.encode()) > self.context.settings.QUERY_MAX_GENERATED_SQL_KB * 1024:
            raise PublicError(
                "QUERY_COMPILATION_FAILED", "El SQL generado supera el tamaño permitido.", 422
            )
        compilation_id: uuid.UUID | None = None
        if self.context.settings.QUERY_COMPILER_STORE_RESULTS and saved_query is not None:
            model = QueryCompilation(
                saved_query_id=saved_query.id,
                query_revision=saved_query.revision,
                query_fingerprint=result.query_fingerprint,
                compilation_fingerprint=result.compilation_fingerprint,
                compiler_version=result.compiler_version,
                engine=result.engine,
                provider=result.provider,
                server_version=result.server_version,
                status="success",
                sql_template=result.sql,
                parameter_metadata_json={
                    key: asdict(value) for key, value in result.parameter_metadata.items()
                },
                warnings_json=[asdict(item) for item in result.warnings],
                errors_json=[asdict(item) for item in result.errors],
                capabilities_used_json=list(result.capabilities_used),
                complexity_json=asdict(result.complexity),
                compiled_by=user_id,
                duration_ms=duration_ms,
            )
            await self.context.compilations.add(model)
            compilation_id = model.id
        await self.context.audit.record(
            action="query.compile",
            result="success",
            duration_ms=duration_ms,
            connection_id=connection.id,
            actor_user_id=user_id,
            resource_type="saved_query" if saved_query else "query_document",
            resource_id=str(saved_query.id) if saved_query else result.query_fingerprint,
        )
        await self.context.session.commit()
        return compilation_response(result, compilation_id)


class CompileSavedQueryService:
    def __init__(self, context: CompilerContext) -> None:
        self.context = context

    async def execute(
        self, model: SavedQuery, permissions: set[str], user_id: uuid.UUID
    ) -> CompilationResponse:
        try:
            document = UniversalQuery.model_validate(model.query_document_json)
        except ValidationError as error:
            raise PublicError("QUERY_SCHEMA_INVALID", "El borrador no es válido.", 422) from error
        return await CompileUniversalQueryService(self.context).execute(
            document, permissions, user_id, saved_query=model
        )


class GetCompilerCapabilitiesService:
    def __init__(self, context: CompilerContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> CompilerCapabilitiesResponse:
        connection = await self.context.session.get(DatabaseConnection, connection_id)
        if connection is None:
            raise PublicError("RESOURCE_NOT_FOUND", "La conexión no existe.", 404)
        self.context.registry.create(connection.engine)
        warnings = []
        if connection.provider == "mariadb":
            warnings.append(
                CompilationMessageResponse(
                    code="QUERY_PROVIDER_COMPILATION_WARNING",
                    message="MariaDB se compila mediante un perfil compatible limitado.",
                )
            )
        return CompilerCapabilitiesResponse(
            connection_id=connection.id,
            engine=connection.engine,
            provider=connection.provider,
            server_version=connection.raw_version,
            compiler_version=COMPILER_VERSION,
            capabilities=dict(connection.capabilities_json),
            supported_features=[
                "select",
                "joins",
                "subqueries",
                "exists",
                "union",
                "aggregations",
                "polymorphic_joins",
            ],
            warnings=warnings,
        )


def history_response(models: list[QueryCompilation]) -> CompilationHistoryResponse:
    return CompilationHistoryResponse(
        items=[
            CompilationHistoryItem(
                id=item.id,
                saved_query_id=item.saved_query_id,
                query_revision=item.query_revision,
                compilation_fingerprint=item.compilation_fingerprint,
                compiler_version=item.compiler_version,
                engine=item.engine,
                provider=item.provider,
                server_version=item.server_version,
                status=item.status,
                duration_ms=item.duration_ms,
                compiled_at=item.compiled_at,
            )
            for item in models
        ]
    )


def create_compiler_registry() -> QueryCompilerRegistry:
    registry = QueryCompilerRegistry()
    registry.register("mysql", MySQLQueryCompiler)
    return registry
