from collections.abc import Sequence
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
from app.domain.schema.models import (
    EntityType,
    InspectedEntity,
    InspectedField,
    InspectedIndex,
    InspectedIndexField,
    InspectedRelationship,
    InspectedRelationshipField,
    InspectedSchema,
)
from app.domain.schema.types import normalize_native_type

SYSTEM_SCHEMAS = {"information_schema", "mysql", "performance_schema", "sys"}


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

    def inspect_schema(
        self,
        *,
        include_views: bool,
        max_entities: int,
        include_system_schemas: bool,
    ) -> InspectedSchema:
        schema_name = self._parameters.database_name
        if not include_system_schemas and schema_name.casefold() in SYSTEM_SCHEMAS:
            raise PublicError(
                "SCHEMA_METADATA_UNAVAILABLE",
                "La sincronización de esquemas del sistema está deshabilitada.",
                400,
            )
        warnings: list[str] = []
        try:
            with self._engine.connect() as connection:
                entity_rows = connection.execute(
                    text(
                        """
                        SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS,
                               TABLE_COLLATION, TABLE_COMMENT
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = :schema_name
                          AND (:include_views = 1 OR TABLE_TYPE <> 'VIEW')
                        ORDER BY TABLE_NAME
                        """
                    ),
                    {"schema_name": schema_name, "include_views": int(include_views)},
                ).mappings().all()
                if len(entity_rows) > max_entities:
                    raise PublicError(
                        "SCHEMA_METADATA_UNAVAILABLE",
                        "El esquema supera el límite configurado de entidades.",
                        400,
                    )
                field_rows = connection.execute(
                    text(
                        """
                        SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_DEFAULT,
                               IS_NULLABLE, DATA_TYPE, COLUMN_TYPE,
                               CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE,
                               DATETIME_PRECISION, CHARACTER_SET_NAME, COLLATION_NAME,
                               COLUMN_KEY, EXTRA, COLUMN_COMMENT
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = :schema_name
                        ORDER BY TABLE_NAME, ORDINAL_POSITION
                        """
                    ),
                    {"schema_name": schema_name},
                ).mappings().all()
                index_rows = connection.execute(
                    text(
                        """
                        SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX,
                               COLUMN_NAME, COLLATION, SUB_PART, INDEX_TYPE
                        FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA = :schema_name
                        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
                        """
                    ),
                    {"schema_name": schema_name},
                ).mappings().all()
                relationship_rows = connection.execute(
                    text(
                        """
                        SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME,
                               k.ORDINAL_POSITION, k.REFERENCED_TABLE_NAME,
                               k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE
                        FROM information_schema.KEY_COLUMN_USAGE k
                        JOIN information_schema.REFERENTIAL_CONSTRAINTS r
                          ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
                         AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
                         AND r.TABLE_NAME = k.TABLE_NAME
                        WHERE k.TABLE_SCHEMA = :schema_name
                          AND k.REFERENCED_TABLE_SCHEMA = :schema_name
                          AND k.REFERENCED_TABLE_NAME IS NOT NULL
                        ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION
                        """
                    ),
                    {"schema_name": schema_name},
                ).mappings().all()
        except PublicError:
            raise
        except (OperationalError, DBAPIError, SQLAlchemyError) as error:
            mapped = map_mysql_error(error)
            if mapped.code == "AUTHENTICATION_FAILED":
                raise
            raise PublicError(
                "SCHEMA_PERMISSION_DENIED",
                "No fue posible leer los metadatos del esquema.",
                403,
            ) from error

        indexes_by_entity = self._group_indexes(index_rows, warnings)
        unique_fields = {
            (table_name, item.fields[0].physical_name)
            for table_name, indexes in indexes_by_entity.items()
            for item in indexes
            if item.is_unique
            and not item.is_primary
            and len(item.fields) == 1
            and item.fields[0].physical_name is not None
        }
        fields_by_entity: dict[str, list[InspectedField]] = {}
        for row in field_rows:
            table_name = str(row["TABLE_NAME"])
            physical_name = str(row["COLUMN_NAME"])
            fields_by_entity.setdefault(table_name, []).append(
                InspectedField(
                    physical_name=physical_name,
                    ordinal_position=int(row["ORDINAL_POSITION"]),
                    native_data_type=str(row["DATA_TYPE"]),
                    normalized_data_type=normalize_native_type(
                        str(row["DATA_TYPE"]), str(row["COLUMN_TYPE"])
                    ),
                    column_type=str(row["COLUMN_TYPE"]),
                    is_nullable=str(row["IS_NULLABLE"]) == "YES",
                    default_value=_serialize_default(row["COLUMN_DEFAULT"]),
                    is_primary_key=str(row["COLUMN_KEY"]) == "PRI",
                    is_unique=(table_name, physical_name) in unique_fields,
                    is_auto_increment="auto_increment" in str(row["EXTRA"]).casefold(),
                    character_maximum_length=_optional_int(
                        row["CHARACTER_MAXIMUM_LENGTH"]
                    ),
                    numeric_precision=_optional_int(row["NUMERIC_PRECISION"]),
                    numeric_scale=_optional_int(row["NUMERIC_SCALE"]),
                    datetime_precision=_optional_int(row["DATETIME_PRECISION"]),
                    character_set=_optional_string(row["CHARACTER_SET_NAME"]),
                    collation=_optional_string(row["COLLATION_NAME"]),
                    comment=_optional_string(row["COLUMN_COMMENT"]),
                    extra=_optional_string(row["EXTRA"]),
                )
            )
        entities = [
            InspectedEntity(
                physical_name=str(row["TABLE_NAME"]),
                entity_type=(
                    EntityType.VIEW
                    if str(row["TABLE_TYPE"]) == "VIEW"
                    else EntityType.TABLE
                ),
                schema_name=str(row["TABLE_SCHEMA"]),
                comment=_optional_string(row["TABLE_COMMENT"]),
                estimated_rows=_optional_int(row["TABLE_ROWS"]),
                storage_engine=_optional_string(row["ENGINE"]),
                collation=_optional_string(row["TABLE_COLLATION"]),
                fields=fields_by_entity.get(str(row["TABLE_NAME"]), []),
                indexes=indexes_by_entity.get(str(row["TABLE_NAME"]), []),
            )
            for row in entity_rows
        ]
        relationships = self._group_relationships(relationship_rows)
        return InspectedSchema(schema_name, entities, relationships, warnings)

    @staticmethod
    def _group_indexes(
        rows: Sequence[Any], warnings: list[str]
    ) -> dict[str, list[InspectedIndex]]:
        grouped: dict[tuple[str, str], list[Any]] = {}
        for row in rows:
            grouped.setdefault(
                (str(row["TABLE_NAME"]), str(row["INDEX_NAME"])), []
            ).append(row)
        result: dict[str, list[InspectedIndex]] = {}
        for (table_name, index_name), index_rows in grouped.items():
            fields = []
            for row in index_rows:
                column_name = _optional_string(row["COLUMN_NAME"])
                if column_name is None:
                    warnings.append(
                        f"El índice {table_name}.{index_name} contiene una expresión no mapeada."
                    )
                fields.append(
                    InspectedIndexField(
                        physical_name=column_name,
                        sequence=int(row["SEQ_IN_INDEX"]),
                        sort_direction=_optional_string(row["COLLATION"]),
                        prefix_length=_optional_int(row["SUB_PART"]),
                    )
                )
            first = index_rows[0]
            result.setdefault(table_name, []).append(
                InspectedIndex(
                    physical_name=index_name,
                    index_type=_optional_string(first["INDEX_TYPE"]),
                    is_unique=not bool(first["NON_UNIQUE"]),
                    is_primary=index_name == "PRIMARY",
                    fields=fields,
                )
            )
        return result

    @staticmethod
    def _group_relationships(rows: Sequence[Any]) -> list[InspectedRelationship]:
        grouped: dict[tuple[str, str, str], list[Any]] = {}
        for row in rows:
            grouped.setdefault(
                (
                    str(row["CONSTRAINT_NAME"]),
                    str(row["TABLE_NAME"]),
                    str(row["REFERENCED_TABLE_NAME"]),
                ),
                [],
            ).append(row)
        return [
            InspectedRelationship(
                constraint_name=key[0],
                source_entity=key[1],
                target_entity=key[2],
                update_rule=_optional_string(rows_for_key[0]["UPDATE_RULE"]),
                delete_rule=_optional_string(rows_for_key[0]["DELETE_RULE"]),
                fields=[
                    InspectedRelationshipField(
                        source_field=str(row["COLUMN_NAME"]),
                        target_field=str(row["REFERENCED_COLUMN_NAME"]),
                        sequence=int(row["ORDINAL_POSITION"]),
                    )
                    for row in rows_for_key
                ],
            )
            for key, rows_for_key in grouped.items()
        ]

    def close(self) -> None:
        self._engine.dispose()


def _optional_string(value: object) -> str | None:
    return None if value is None else str(value)


def _optional_int(value: object) -> int | None:
    return None if value is None else int(str(value))


def _serialize_default(value: object) -> str | int | float | bool | None:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


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
