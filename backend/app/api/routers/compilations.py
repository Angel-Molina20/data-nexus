import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import (
    AuthContextDependency,
    CompilerContextDependency,
    CurrentPrincipal,
    QueryContextDependency,
    require_csrf,
    require_permission,
)
from app.api.schemas.compilations import (
    CompilationHistoryResponse,
    CompilationRequest,
    CompilationResponse,
    CompilerCapabilitiesResponse,
)
from app.application.auth import AuthorizationService
from app.application.compilations import (
    CompileSavedQueryService,
    CompileUniversalQueryService,
    GetCompilerCapabilitiesService,
    history_response,
)
from app.application.queries import SavedQueryService
from app.domain.connections.errors import PublicError

router = APIRouter(prefix="/query-compiler", tags=["query-compiler"])
saved_router = APIRouter(prefix="/queries", tags=["query-compilations"])


@router.post(
    "/compile",
    response_model=CompilationResponse,
    dependencies=[Depends(require_permission("queries.compile")), Depends(require_csrf)],
)
async def compile_document(
    payload: CompilationRequest,
    context: CompilerContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> CompilationResponse:
    await AuthorizationService(auth.auth).require_connection_access(
        principal, payload.document.connection_id, "analyst"
    )
    return await CompileUniversalQueryService(context).execute(
        payload.document,
        principal.permissions,
        principal.user.id,
        mode=payload.mode,
        preview_values=payload.preview_values,
    )


@router.get(
    "/capabilities/{connection_id}",
    response_model=CompilerCapabilitiesResponse,
    dependencies=[Depends(require_permission("queries.compile"))],
)
async def compiler_capabilities(
    connection_id: uuid.UUID,
    context: CompilerContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> CompilerCapabilitiesResponse:
    await AuthorizationService(auth.auth).require_connection_access(
        principal, connection_id, "analyst"
    )
    return await GetCompilerCapabilitiesService(context).execute(connection_id)


@saved_router.post(
    "/{query_id}/compile",
    response_model=CompilationResponse,
    dependencies=[Depends(require_permission("queries.compile")), Depends(require_csrf)],
)
async def compile_saved_query(
    query_id: uuid.UUID,
    context: CompilerContextDependency,
    queries: QueryContextDependency,
    auth: AuthContextDependency,
    principal: CurrentPrincipal,
) -> CompilationResponse:
    model = await SavedQueryService(queries).require(query_id, principal.user.id)
    await AuthorizationService(auth.auth).require_connection_access(
        principal, model.connection_id, "analyst"
    )
    return await CompileSavedQueryService(context).execute(
        model, principal.permissions, principal.user.id
    )


@saved_router.get(
    "/{query_id}/compilations",
    response_model=CompilationHistoryResponse,
    dependencies=[Depends(require_permission("queries.compile"))],
)
async def list_compilations(
    query_id: uuid.UUID,
    context: CompilerContextDependency,
    queries: QueryContextDependency,
    principal: CurrentPrincipal,
) -> CompilationHistoryResponse:
    await SavedQueryService(queries).require(query_id, principal.user.id)
    return history_response(await context.compilations.list_for_query(query_id))


@saved_router.get(
    "/{query_id}/compilations/{compilation_id}",
    response_model=CompilationResponse,
    dependencies=[Depends(require_permission("queries.compile"))],
)
async def get_compilation(
    query_id: uuid.UUID,
    compilation_id: uuid.UUID,
    context: CompilerContextDependency,
    queries: QueryContextDependency,
    principal: CurrentPrincipal,
) -> CompilationResponse:
    await SavedQueryService(queries).require(query_id, principal.user.id)
    model = await context.compilations.get(compilation_id)
    if model is None or model.saved_query_id != query_id:
        raise PublicError("QUERY_COMPILATION_STALE", "La compilación no existe.", 404)
    from app.api.schemas.compilations import (
        CompilationMessageResponse,
        ParameterMetadataResponse,
    )
    from app.api.schemas.queries import ComplexityResponse

    return CompilationResponse(
        id=model.id,
        success=model.status == "success",
        engine=model.engine,
        provider=model.provider,
        server_version=model.server_version,
        dialect="mysql",
        compiler_version=model.compiler_version,
        sql=model.sql_template,
        parameters={
            key: ParameterMetadataResponse(**value)
            for key, value in model.parameter_metadata_json.items()
        },
        warnings=[CompilationMessageResponse(**item) for item in model.warnings_json],
        errors=[CompilationMessageResponse(**item) for item in model.errors_json],
        capabilities_used=model.capabilities_used_json,
        referenced_entities=[],
        referenced_fields=[],
        referenced_relationships=[],
        query_fingerprint=model.query_fingerprint,
        compilation_fingerprint=model.compilation_fingerprint,
        complexity=ComplexityResponse(**model.complexity_json),
        executed=False,
    )
