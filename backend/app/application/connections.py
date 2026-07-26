import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from anyio import to_thread
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.connections import (
    CapabilitiesResponse,
    ConnectionCreateRequest,
    ConnectionDetailResponse,
    ConnectionListResponse,
    ConnectionSummaryResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ConnectionUpdateRequest,
    ServerResponse,
    ServerVersionResponse,
)
from app.db.models.database_connection import DatabaseConnection
from app.domain.connections.errors import RESOURCE_NOT_FOUND, PublicError
from app.domain.connections.models import (
    ConnectionParameters,
    ConnectionStatus,
    Engine,
    Provider,
)
from app.domain.connections.versioning import detect_provider, parse_server_version
from app.infrastructure.adapters.registry import AdapterRegistry
from app.infrastructure.network.policy import DatabaseHostPolicy
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.connections import DatabaseConnectionRepository
from app.infrastructure.security.encryption import CredentialEncryption

TECHNICAL_FIELDS = {
    "host", "port", "database_name", "username", "password", "ssl_enabled", "configuration"
}


@dataclass(slots=True)
class ConnectionContext:
    session: AsyncSession
    connections: DatabaseConnectionRepository
    audit: AuditRepository
    adapters: AdapterRegistry
    encryption: CredentialEncryption
    host_policy: DatabaseHostPolicy


async def _inspect(
    context: ConnectionContext,
    request: ConnectionTestRequest,
) -> ConnectionTestResponse:
    context.host_policy.validate(request.host, request.port)
    parameters = ConnectionParameters(
        host=request.host,
        port=request.port,
        database_name=request.database_name,
        username=request.username,
        password=request.password.get_secret_value(),
        ssl_enabled=request.ssl_enabled,
        configuration=request.configuration,
    )
    adapter = context.adapters.create(Engine.MYSQL, parameters)
    try:
        await to_thread.run_sync(adapter.test_connection)
        inspection = await to_thread.run_sync(adapter.inspect_server)
        capabilities = await to_thread.run_sync(adapter.detect_capabilities)
    finally:
        await to_thread.run_sync(adapter.close)
    parsed = parse_server_version(inspection.version)
    provider = detect_provider(inspection.version, inspection.version_comment)
    warnings = []
    if provider is Provider.MARIADB:
        warnings.append("MariaDB fue detectado; su compatibilidad completa no está garantizada.")
    if provider is Provider.UNKNOWN:
        warnings.append("No fue posible identificar con certeza el proveedor.")
    return ConnectionTestResponse(
        server=ServerResponse(
            engine=Engine.MYSQL,
            provider=provider,
            raw_version=inspection.version,
            version=ServerVersionResponse(
                major=parsed.major, minor=parsed.minor, patch=parsed.patch
            ),
            version_comment=inspection.version_comment,
            sql_mode=inspection.sql_mode,
            character_set=inspection.character_set,
            collation=inspection.collation,
            timezone=inspection.timezone,
            current_database=inspection.current_database,
        ),
        capabilities=CapabilitiesResponse(**capabilities.as_dict()),
        warnings=warnings,
    )


async def _audit_call(
    context: ConnectionContext,
    action: str,
    operation: object,
    connection_id: uuid.UUID | None = None,
) -> object:
    started = time.monotonic()
    try:
        result = await operation  # type: ignore[misc]
    except PublicError as error:
        await context.audit.record(
            action=action,
            result="error",
            duration_ms=int((time.monotonic() - started) * 1000),
            connection_id=connection_id,
            error_code=error.code,
        )
        await context.session.commit()
        raise
    await context.audit.record(
        action=action,
        result="success",
        duration_ms=int((time.monotonic() - started) * 1000),
        connection_id=connection_id,
    )
    await context.session.commit()
    return result


class TestConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(self, request: ConnectionTestRequest) -> ConnectionTestResponse:
        return await _audit_call(self.context, "connection.test", _inspect(self.context, request))  # type: ignore[return-value]


class CreateConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(self, request: ConnectionCreateRequest) -> ConnectionDetailResponse:
        async def operation() -> ConnectionDetailResponse:
            if await self.context.connections.name_exists(request.name):
                raise PublicError(
                    "CONNECTION_IN_USE", "Ya existe una conexión con ese nombre.", 409
                )
            tested = await _inspect(self.context, request)
            server = tested.server
            model = DatabaseConnection(
                name=request.name,
                engine=request.engine,
                provider=server.provider,
                host=request.host,
                port=request.port,
                database_name=request.database_name,
                username=request.username,
                encrypted_password=self.context.encryption.encrypt_secret(
                    request.password.get_secret_value()
                ),
                ssl_enabled=request.ssl_enabled,
                configuration_json=request.configuration,
                raw_version=server.raw_version,
                major_version=server.version.major,
                minor_version=server.version.minor,
                patch_version=server.version.patch,
                version_comment=server.version_comment,
                sql_mode=server.sql_mode,
                character_set=server.character_set,
                collation=server.collation,
                timezone=server.timezone,
                capabilities_json=tested.capabilities.model_dump(),
                status=ConnectionStatus.CONNECTED,
                last_tested_at=datetime.now(UTC),
            )
            await self.context.connections.create(model)
            return to_detail(model)

        return await _audit_call(self.context, "connection.create", operation())  # type: ignore[return-value]


class ListConnectionsService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(
        self, search: str | None, status: str | None, page: int, page_size: int
    ) -> ConnectionListResponse:
        items, total = await self.context.connections.list(
            search=search, status=status, page=page, page_size=page_size
        )
        return ConnectionListResponse(
            items=[ConnectionSummaryResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )


class GetConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> ConnectionDetailResponse:
        return to_detail(await require_connection(self.context, connection_id))


class UpdateConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(
        self, connection_id: uuid.UUID, request: ConnectionUpdateRequest
    ) -> ConnectionDetailResponse:
        model = await require_connection(self.context, connection_id)

        async def operation() -> ConnectionDetailResponse:
            changes = request.model_dump(exclude_unset=True)
            if "name" in changes and await self.context.connections.name_exists(
                changes["name"], exclude_id=connection_id
            ):
                raise PublicError(
                    "CONNECTION_IN_USE", "Ya existe una conexión con ese nombre.", 409
                )
            technical = bool(TECHNICAL_FIELDS.intersection(changes))
            password = (
                request.password.get_secret_value()
                if request.password is not None
                else self.context.encryption.decrypt_secret(model.encrypted_password)
            )
            if technical:
                test_request = ConnectionTestRequest(
                    name=changes.get("name", model.name),
                    host=changes.get("host", model.host),
                    port=changes.get("port", model.port),
                    database_name=changes.get("database_name", model.database_name),
                    username=changes.get("username", model.username),
                    password=SecretStr(password),
                    ssl_enabled=changes.get("ssl_enabled", model.ssl_enabled),
                    configuration=changes.get("configuration", model.configuration_json),
                )
                tested = await _inspect(self.context, test_request)
                apply_server(model, tested)
                model.last_tested_at = datetime.now(UTC)
                model.status = ConnectionStatus.CONNECTED
                if request.password is not None:
                    model.encrypted_password = self.context.encryption.encrypt_secret(password)
            for source, target in {
                "name": "name", "host": "host", "port": "port",
                "database_name": "database_name", "username": "username",
                "ssl_enabled": "ssl_enabled", "configuration": "configuration_json",
            }.items():
                if source in changes:
                    setattr(model, target, changes[source])
            await self.context.session.flush()
            await self.context.session.refresh(model)
            return to_detail(model)

        return await _audit_call(
            self.context, "connection.update", operation(), connection_id
        )  # type: ignore[return-value]


class DeleteConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> None:
        model = await require_connection(self.context, connection_id)

        async def operation() -> None:
            await self.context.connections.delete(model)

        await _audit_call(self.context, "connection.delete", operation(), connection_id)


class RetestConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self.context = context

    async def execute(self, connection_id: uuid.UUID) -> ConnectionTestResponse:
        model = await require_connection(self.context, connection_id)

        async def operation() -> ConnectionTestResponse:
            request = ConnectionTestRequest(
                name=model.name,
                host=model.host,
                port=model.port,
                database_name=model.database_name,
                username=model.username,
                password=SecretStr(
                    self.context.encryption.decrypt_secret(model.encrypted_password)
                ),
                ssl_enabled=model.ssl_enabled,
                configuration=model.configuration_json,
            )
            try:
                tested = await _inspect(self.context, request)
            except PublicError as error:
                model.status = ConnectionStatus.ERROR
                model.last_tested_at = datetime.now(UTC)
                model.last_error_code = error.code
                model.last_error_message = error.message
                await self.context.session.flush()
                raise
            apply_server(model, tested)
            model.status = ConnectionStatus.CONNECTED
            model.last_tested_at = datetime.now(UTC)
            model.last_error_code = None
            model.last_error_message = None
            await self.context.session.flush()
            return tested

        return await _audit_call(
            self.context, "connection.retest", operation(), connection_id
        )  # type: ignore[return-value]


async def require_connection(
    context: ConnectionContext, connection_id: uuid.UUID
) -> DatabaseConnection:
    model = await context.connections.get(connection_id)
    if model is None:
        raise PublicError(*RESOURCE_NOT_FOUND, status_code=404)
    return model


def apply_server(model: DatabaseConnection, tested: ConnectionTestResponse) -> None:
    server = tested.server
    model.provider = server.provider
    model.raw_version = server.raw_version
    model.major_version = server.version.major
    model.minor_version = server.version.minor
    model.patch_version = server.version.patch
    model.version_comment = server.version_comment
    model.sql_mode = server.sql_mode
    model.character_set = server.character_set
    model.collation = server.collation
    model.timezone = server.timezone
    model.capabilities_json = tested.capabilities.model_dump()


def to_detail(model: DatabaseConnection) -> ConnectionDetailResponse:
    version = None
    if model.major_version is not None:
        version = ServerVersionResponse(
            major=model.major_version,
            minor=model.minor_version or 0,
            patch=model.patch_version or 0,
        )
    return ConnectionDetailResponse(
        id=model.id,
        name=model.name,
        engine=Engine(model.engine),
        provider=Provider(model.provider),
        host=model.host,
        port=model.port,
        database_name=model.database_name,
        username=model.username,
        ssl_enabled=model.ssl_enabled,
        configuration=model.configuration_json,
        status=ConnectionStatus(model.status),
        raw_version=model.raw_version,
        version=version,
        version_comment=model.version_comment,
        sql_mode=model.sql_mode,
        character_set=model.character_set,
        collation=model.collation,
        timezone=model.timezone,
        capabilities=CapabilitiesResponse(**model.capabilities_json),
        last_tested_at=model.last_tested_at,
        last_error_code=model.last_error_code,
        last_error_message=model.last_error_message,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )
