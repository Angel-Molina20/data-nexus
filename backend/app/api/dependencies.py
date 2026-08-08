import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated, cast
from urllib.parse import urlsplit

from fastapi import Cookie, Depends, Header, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.context_factories import (
    build_compiler_context,
    build_connection_context,
    build_execution_context,
    build_query_context,
    build_relationship_context,
    build_report_context,
    build_schema_context,
)
from app.application.auth import AuthContext, AuthorizationService, SessionPrincipal, SessionService
from app.application.compilations import CompilerContext
from app.application.connections import ConnectionContext
from app.application.executions import ExecutionContext
from app.application.queries import QueryContext
from app.application.relationships import RelationshipContext
from app.application.reports import ReportContext
from app.application.schema import SchemaContext
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.domain.connections.errors import PublicError
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.auth import AuthRepository
from app.infrastructure.security.passwords import password_service
from app.infrastructure.security.rate_limit import RateLimiter


def get_redis_client() -> Redis:
    return cast(Redis, Redis.from_url(get_settings().redis_url, decode_responses=True))


async def close_redis_client() -> None:
    return None


async def get_auth_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncIterator[AuthContext]:
    repository = AuthRepository(session)
    redis = get_redis_client()
    try:
        yield AuthContext(
            session=session,
            auth=repository,
            audit=AuditRepository(session),
            passwords=password_service,
            limiter=RateLimiter(redis, settings),
            settings=settings,
        )
    finally:
        await redis.aclose()


AuthContextDependency = Annotated[AuthContext, Depends(get_auth_context)]


async def get_current_principal(
    context: AuthContextDependency,
    session_token: Annotated[str | None, Cookie(alias=get_settings().SESSION_COOKIE_NAME)] = None,
) -> SessionPrincipal:
    if not session_token:
        raise PublicError("AUTHENTICATION_REQUIRED", "Debes iniciar sesión.", 401)
    return await SessionService(context).resolve(session_token)


CurrentPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]


def require_permission(
    code: str,
) -> Callable[[CurrentPrincipal], Awaitable[SessionPrincipal]]:
    async def dependency(principal: CurrentPrincipal) -> SessionPrincipal:
        AuthorizationService.require_permission(principal, code)
        return principal

    return dependency


async def require_csrf(
    request: Request,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
    csrf_token: Annotated[str | None, Header(alias=get_settings().CSRF_HEADER_NAME)] = None,
) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    if origin is None and referer:
        parsed = urlsplit(referer)
        origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin is None or origin not in context.settings.ALLOWED_ORIGINS:
        raise PublicError("ORIGIN_NOT_ALLOWED", "El origen de la solicitud no está permitido.", 403)
    await SessionService(context).validate_csrf(principal, csrf_token)


async def require_authenticated_request(_: CurrentPrincipal) -> None:
    return None


async def require_sensitive_rate_limit(
    request: Request,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> None:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        await context.limiter.sensitive(principal.user.normalized_email, request.url.path)


async def require_connection_viewer(
    connection_id: uuid.UUID,
    request: Request,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> SessionPrincipal:
    required = "manager" if request.method in {"POST", "PUT", "PATCH", "DELETE"} else "viewer"
    await AuthorizationService(context.auth).require_connection_access(
        principal, connection_id, required
    )
    return principal


async def require_connection_manager(
    connection_id: uuid.UUID,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> SessionPrincipal:
    await AuthorizationService(context.auth).require_connection_access(
        principal, connection_id, "manager"
    )
    return principal


def get_connection_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ConnectionContext:
    return build_connection_context(session, get_settings())


ConnectionContextDependency = Annotated[ConnectionContext, Depends(get_connection_context)]


def get_schema_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SchemaContext:
    return build_schema_context(session, get_settings())


SchemaContextDependency = Annotated[SchemaContext, Depends(get_schema_context)]


def get_relationship_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RelationshipContext:
    return build_relationship_context(session, settings)


RelationshipContextDependency = Annotated[RelationshipContext, Depends(get_relationship_context)]


def get_query_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> QueryContext:
    return build_query_context(session, settings)


QueryContextDependency = Annotated[QueryContext, Depends(get_query_context)]


def get_compiler_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CompilerContext:
    return build_compiler_context(session, settings)


CompilerContextDependency = Annotated[CompilerContext, Depends(get_compiler_context)]


def get_execution_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ExecutionContext:
    return build_execution_context(session, settings)


ExecutionContextDependency = Annotated[ExecutionContext, Depends(get_execution_context)]


def get_report_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReportContext:
    return build_report_context(session, settings)


ReportContextDependency = Annotated[ReportContext, Depends(get_report_context)]
