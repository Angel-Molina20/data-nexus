from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compilations import CompilerContext, create_compiler_registry
from app.application.connections import ConnectionContext
from app.application.executions import ExecutionContext
from app.application.queries import QueryContext
from app.application.relationships import RelationshipContext
from app.application.reports import ReportContext
from app.application.schema import SchemaContext
from app.core.config import Settings
from app.domain.connections.models import ConnectionParameters, Engine
from app.infrastructure.adapters.active_executions import active_execution_registry
from app.infrastructure.adapters.mysql import MySQLAdapter
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.exporters.registry import ReportExporterRegistry
from app.infrastructure.network.policy import DatabaseHostPolicy
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.auth import AuthRepository
from app.infrastructure.repositories.compilations import CompilationRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.repositories.executions import QueryExecutionRepository
from app.infrastructure.repositories.queries import SavedQueryRepository
from app.infrastructure.repositories.reports import ReportExportRepository, ReportRepository
from app.infrastructure.repositories.schema import SchemaRepository
from app.infrastructure.repositories.semantic import SemanticCatalogRepository
from app.infrastructure.security.encryption import get_credential_encryption
from app.infrastructure.storage.local import LocalFileStorage


def build_adapter_registry(settings: Settings) -> AdapterRegistry:
    registry = AdapterRegistry()

    def mysql_factory(parameters: ConnectionParameters) -> MySQLAdapter:
        return MySQLAdapter(
            parameters,
            connect_timeout=settings.MYSQL_CONNECT_TIMEOUT,
            read_timeout=settings.MYSQL_READ_TIMEOUT,
            write_timeout=settings.MYSQL_WRITE_TIMEOUT,
        )

    registry.register(Engine.MYSQL, mysql_factory)
    return registry


def build_connection_context(session: AsyncSession, settings: Settings) -> ConnectionContext:
    return ConnectionContext(
        session=session,
        connections=DatabaseConnectionRepository(session),
        audit=AuditRepository(session),
        adapters=build_adapter_registry(settings),
        encryption=get_credential_encryption(),
        host_policy=DatabaseHostPolicy(
            allow_private=settings.ALLOW_PRIVATE_DATABASE_HOSTS,
            allowed_hosts=settings.ALLOWED_DATABASE_HOSTS,
            blocked_hosts=settings.BLOCKED_DATABASE_HOSTS,
        ),
    )


def build_schema_context(session: AsyncSession, settings: Settings) -> SchemaContext:
    connection = build_connection_context(session, settings)
    return SchemaContext(
        session=session,
        connections=connection.connections,
        schemas=SchemaRepository(session),
        audit=connection.audit,
        adapters=connection.adapters,
        encryption=connection.encryption,
        host_policy=connection.host_policy,
        settings=settings,
    )


def build_relationship_context(session: AsyncSession, settings: Settings) -> RelationshipContext:
    return RelationshipContext(
        session=session,
        connections=DatabaseConnectionRepository(session),
        catalog=SemanticCatalogRepository(session),
        audit=AuditRepository(session),
        settings=settings,
    )


def build_query_context(session: AsyncSession, settings: Settings) -> QueryContext:
    return QueryContext(
        session=session,
        repository=SavedQueryRepository(session),
        audit=AuditRepository(session),
        settings=settings,
    )


def build_compiler_context(session: AsyncSession, settings: Settings) -> CompilerContext:
    query = build_query_context(session, settings)
    return CompilerContext(
        session=session,
        compilations=CompilationRepository(session),
        queries=query,
        audit=query.audit,
        settings=settings,
        registry=create_compiler_registry(),
    )


def build_execution_context(session: AsyncSession, settings: Settings) -> ExecutionContext:
    connection = build_connection_context(session, settings)
    return ExecutionContext(
        session=session,
        executions=QueryExecutionRepository(session),
        compiler=build_compiler_context(session, settings),
        adapters=connection.adapters,
        encryption=connection.encryption,
        active=active_execution_registry,
        settings=settings,
    )


def build_report_context(session: AsyncSession, settings: Settings) -> ReportContext:
    return ReportContext(
        session=session,
        reports=ReportRepository(session),
        exports=ReportExportRepository(session),
        execution=build_execution_context(session, settings),
        audit=AuditRepository(session),
        auth=AuthRepository(session),
        exporters=ReportExporterRegistry(settings),
        storage=LocalFileStorage(settings.REPORT_EXPORT_STORAGE_PATH),
        settings=settings,
    )
