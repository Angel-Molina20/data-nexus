from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.connections import ConnectionContext
from app.core.config import get_settings
from app.db.session import get_db_session
from app.domain.connections.models import ConnectionParameters, Engine
from app.infrastructure.adapters.mysql import MySQLAdapter
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.network.policy import DatabaseHostPolicy
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.security.encryption import get_credential_encryption


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
