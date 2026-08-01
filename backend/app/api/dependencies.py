import uuid
from collections.abc import AsyncIterator
from typing import Annotated, cast
from urllib.parse import urlsplit

from fastapi import Cookie, Depends, Header, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth import AuthContext, AuthorizationService, SessionPrincipal, SessionService
from app.application.compilations import CompilerContext, create_compiler_registry
from app.application.connections import ConnectionContext
from app.application.queries import QueryContext
from app.application.relationships import RelationshipContext
from app.application.schema import SchemaContext
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.domain.connections.models import ConnectionParameters, Engine
from app.infrastructure.adapters.mysql import MySQLAdapter
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.network.policy import DatabaseHostPolicy
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.auth import AuthRepository
from app.infrastructure.repositories.compilations import CompilationRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.repositories.queries import SavedQueryRepository
from app.infrastructure.repositories.schema import SchemaRepository
from app.infrastructure.repositories.semantic import SemanticCatalogRepository
from app.infrastructure.security.encryption import get_credential_encryption
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
        from app.domain.connections.errors import PublicError

        raise PublicError("AUTHENTICATION_REQUIRED", "Debes iniciar sesión.", 401)
    return await SessionService(context).resolve(session_token)


CurrentPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]


def require_permission(code: str):  # type: ignore[no-untyped-def]
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
        from app.domain.connections.errors import PublicError

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
    settings = get_settings()
    registry = AdapterRegistry()

    def mysql_factory(parameters: ConnectionParameters) -> MySQLAdapter:
        return MySQLAdapter(
            parameters,
            connect_timeout=settings.MYSQL_CONNECT_TIMEOUT,
            read_timeout=settings.MYSQL_READ_TIMEOUT,
            write_timeout=settings.MYSQL_WRITE_TIMEOUT,
        )

    registry.register(Engine.MYSQL, mysql_factory)
    return ConnectionContext(
        session=session,
        connections=DatabaseConnectionRepository(session),
        audit=AuditRepository(session),
        adapters=registry,
        encryption=get_credential_encryption(),
        host_policy=DatabaseHostPolicy(
            allow_private=settings.ALLOW_PRIVATE_DATABASE_HOSTS,
            allowed_hosts=settings.ALLOWED_DATABASE_HOSTS,
            blocked_hosts=settings.BLOCKED_DATABASE_HOSTS,
        ),
    )


ConnectionContextDependency = Annotated[ConnectionContext, Depends(get_connection_context)]


def get_schema_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SchemaContext:
    base = get_connection_context(session)
    return SchemaContext(
        session=session,
        connections=base.connections,
        schemas=SchemaRepository(session),
        audit=base.audit,
        adapters=base.adapters,
        encryption=base.encryption,
        host_policy=base.host_policy,
        settings=get_settings(),
    )


SchemaContextDependency = Annotated[SchemaContext, Depends(get_schema_context)]


def get_relationship_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RelationshipContext:
    return RelationshipContext(
        session=session,
        connections=DatabaseConnectionRepository(session),
        catalog=SemanticCatalogRepository(session),
        audit=AuditRepository(session),
        settings=settings,
    )


RelationshipContextDependency = Annotated[RelationshipContext, Depends(get_relationship_context)]


def get_query_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> QueryContext:
    return QueryContext(
        session=session,
        repository=SavedQueryRepository(session),
        audit=AuditRepository(session),
        settings=settings,
    )


QueryContextDependency = Annotated[QueryContext, Depends(get_query_context)]


def get_compiler_context(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CompilerContext:
    query_context = QueryContext(
        session=session,
        repository=SavedQueryRepository(session),
        audit=AuditRepository(session),
        settings=settings,
    )
    return CompilerContext(
        session=session,
        compilations=CompilationRepository(session),
        queries=query_context,
        audit=query_context.audit,
        settings=settings,
        registry=create_compiler_registry(),
    )


CompilerContextDependency = Annotated[CompilerContext, Depends(get_compiler_context)]
