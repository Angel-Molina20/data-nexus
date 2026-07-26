from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any


class Engine(StrEnum):
    MYSQL = "mysql"


class Provider(StrEnum):
    MYSQL = "mysql"
    PERCONA = "percona"
    MARIADB = "mariadb"
    UNKNOWN = "unknown"


class ConnectionStatus(StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    TESTING = "testing"


@dataclass(frozen=True, slots=True)
class ConnectionParameters:
    host: str
    port: int
    database_name: str
    username: str
    password: str
    ssl_enabled: bool = False
    configuration: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ParsedVersion:
    raw: str
    major: int
    minor: int
    patch: int

    @property
    def tuple(self) -> tuple[int, int, int]:
        return (self.major, self.minor, self.patch)


@dataclass(frozen=True, slots=True)
class ServerInspection:
    version: str
    version_comment: str | None
    sql_mode: str | None
    character_set: str | None
    collation: str | None
    timezone: str | None
    current_database: str | None
    server_limits: dict[str, int | None] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class MySQLCapabilities:
    supports_subqueries: bool = True
    supports_derived_tables: bool = True
    supports_joins: bool = True
    supports_grouping: bool = True
    supports_union: bool = True
    supports_cte: bool = False
    supports_recursive_cte: bool = False
    supports_window_functions: bool = False
    supports_json_type: bool = False
    supports_json_table: bool = False
    supports_explain_json: bool = False
    supports_explain_tree: bool = False
    supports_explain_analyze: bool = False

    def as_dict(self) -> dict[str, bool]:
        return {name: bool(value) for name, value in asdict(self).items()}
