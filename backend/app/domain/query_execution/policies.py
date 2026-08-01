import re

from app.domain.connections.errors import PublicError

_ROOT_SELECT = re.compile(r"^\s*(?:\(+\s*)?SELECT\b", re.IGNORECASE)
_FORBIDDEN = re.compile(
    r"\b(?:INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO|HANDLER|LOAD)\b",
    re.IGNORECASE,
)


def ensure_compiled_read_only(sql: str) -> None:
    """Defense in depth for SQL emitted by a trusted compiler."""
    if not _ROOT_SELECT.search(sql) or _FORBIDDEN.search(sql):
        raise PublicError("QUERY_NOT_READ_ONLY", "Solo se permiten consultas de lectura.", 400)
    stripped = sql.strip()
    if ";" in stripped.rstrip(";") or "--" in stripped or "/*" in stripped or "#" in stripped:
        raise PublicError("QUERY_NOT_READ_ONLY", "La consulta compilada no es segura.", 400)
