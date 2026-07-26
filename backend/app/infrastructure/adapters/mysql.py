from typing import Any

from pymysql.err import OperationalError
from sqlalchemy import URL, Engine, create_engine, text
from sqlalchemy.exc import DBAPIError, SQLAlchemyError

from app.domain.connections.adapters import DataSourceAdapter
from app.domain.connections.capabilities import build_mysql_capabilities
from app.domain.connections.errors import PublicError
from app.domain.connections.models import (
    ConnectionParameters,
    MySQLCapabilities,
    ServerInspection,
)
from app.domain.connections.versioning import detect_provider, parse_server_version


class MySQLAdapter(DataSourceAdapter):
    def __init__(
        self,
        parameters: ConnectionParameters,
        *,
        connect_timeout: int,
        read_timeout: int,
        write_timeout: int,
    ) -> None:
        self._parameters = parameters
        connect_args: dict[str, Any] = {
            "connect_timeout": connect_timeout,
            "read_timeout": read_timeout,
            "write_timeout": write_timeout,
        }
        if parameters.ssl_enabled:
            connect_args["ssl"] = {}
        url = URL.create(
            "mysql+pymysql",
            username=parameters.username,
            password=parameters.password,
            host=parameters.host,
            port=parameters.port,
            database=parameters.database_name,
        )
        self._engine: Engine = create_engine(
            url,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self._inspection: ServerInspection | None = None

    def test_connection(self) -> None:
        try:
            with self._engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except (OperationalError, DBAPIError, SQLAlchemyError) as error:
            raise map_mysql_error(error) from error

    def inspect_server(self) -> ServerInspection:
        try:
            with self._engine.connect() as connection:
                row = connection.execute(
                    text(
                        """
                        SELECT VERSION() AS version,
                          @@version_comment AS version_comment,
                          @@SESSION.sql_mode AS sql_mode,
                          @@character_set_database AS character_set_database,
                          @@collation_database AS collation_database,
                          @@session.time_zone AS session_time_zone,
                          DATABASE() AS current_database
                        """
                    )
                ).mappings().one()
                limits: dict[str, int | None] = {}
                try:
                    limit_row = connection.execute(
                        text(
                            """
                            SELECT @@max_allowed_packet AS max_allowed_packet,
                              @@wait_timeout AS wait_timeout,
                              @@interactive_timeout AS interactive_timeout
                            """
                        )
                    ).mappings().one()
                    limits = {
                        key: int(value) if value is not None else None
                        for key, value in limit_row.items()
                    }
                except SQLAlchemyError:
                    limits = {}
        except (OperationalError, DBAPIError, SQLAlchemyError) as error:
            raise map_mysql_error(error) from error
        self._inspection = ServerInspection(
            version=str(row.get("version") or ""),
            version_comment=_optional_string(row.get("version_comment")),
            sql_mode=_optional_string(row.get("sql_mode")),
            character_set=_optional_string(row.get("character_set_database")),
            collation=_optional_string(row.get("collation_database")),
            timezone=_optional_string(row.get("session_time_zone")),
            current_database=_optional_string(row.get("current_database")),
            server_limits=limits,
        )
        return self._inspection

    def detect_capabilities(self) -> MySQLCapabilities:
        inspection = self._inspection or self.inspect_server()
        version = parse_server_version(inspection.version)
        provider = detect_provider(inspection.version, inspection.version_comment)
        return build_mysql_capabilities(version.tuple, provider)

    def close(self) -> None:
        self._engine.dispose()


def _optional_string(value: object) -> str | None:
    return None if value is None else str(value)


def map_mysql_error(error: Exception) -> PublicError:
    original = getattr(error, "orig", error)
    code = original.args[0] if getattr(original, "args", ()) else None
    if code == 1045:
        return PublicError("AUTHENTICATION_FAILED", "Las credenciales no fueron aceptadas.", 400)
    if code == 1049:
        return PublicError("DATABASE_NOT_FOUND", "La base de datos indicada no existe.", 400)
    if code in {2002, 2003, 2006, 2013}:
        return PublicError(
            "CONNECTION_FAILED",
            "No fue posible establecer conexión con el servidor.",
            400,
        )
    return PublicError(
        "CONNECTION_FAILED",
        "No fue posible establecer conexión con el servidor.",
        400,
    )
