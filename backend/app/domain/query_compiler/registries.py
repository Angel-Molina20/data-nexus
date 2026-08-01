import re
from typing import Any

from app.domain.connections.errors import PublicError
from app.domain.query_compiler.dialect import MySQLDialect
from app.domain.query_compiler.models import ParameterMetadata
from app.domain.query_model.ast import QueryParameterDefinition

ALIAS_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
MYSQL_RESERVED = {"select", "from", "where", "join", "group", "order", "limit", "table"}


class AliasRegistry:
    def __init__(self, dialect: MySQLDialect) -> None:
        self.dialect = dialect
        self._scopes: dict[str, dict[str, str]] = {}

    def register(self, scope_id: str, source_id: str, alias: str) -> str:
        scope = self._scopes.setdefault(scope_id, {})
        folded = alias.casefold()
        if (
            not ALIAS_PATTERN.fullmatch(alias)
            or folded in MYSQL_RESERVED
            or any(value.casefold() == folded for value in scope.values())
        ):
            raise PublicError(
                "QUERY_ALIAS_COLLISION", "El alias no es válido o está repetido.", 422
            )
        scope[source_id] = alias
        return self.dialect.quote_identifier(alias)

    def resolve(self, scope_id: str, source_id: str) -> str:
        try:
            return self.dialect.quote_identifier(self._scopes[scope_id][source_id])
        except KeyError as error:
            raise PublicError(
                "QUERY_ALIAS_COLLISION", "No fue posible resolver un alias del AST.", 422
            ) from error


class ParameterRegistry:
    def __init__(
        self,
        dialect: MySQLDialect,
        definitions: list[QueryParameterDefinition],
        preview_values: dict[str, Any],
        maximum: int,
    ) -> None:
        self.dialect = dialect
        self.definitions = {item.parameter_id: item for item in definitions}
        self.preview_values = preview_values
        self.maximum = maximum
        self.values: dict[str, Any] = {}
        self.metadata: dict[str, ParameterMetadata] = {}
        self._declared: dict[str, str] = {}

    def _next(self) -> str:
        if len(self.metadata) >= self.maximum:
            raise PublicError(
                "QUERY_PARAMETER_BINDING_FAILED", "La consulta supera el límite de parámetros.", 422
            )
        return f"p_{len(self.metadata) + 1}"

    def literal(self, value: Any, data_type: str, *, sensitive: bool = False) -> str:
        binding = self._next()
        self.values[binding] = value
        self.metadata[binding] = ParameterMetadata(
            binding, "literal", data_type, sensitive, has_value=True
        )
        return self.dialect.placeholder(binding)

    def internal(self, value: Any, data_type: str) -> str:
        binding = self._next()
        self.values[binding] = value
        self.metadata[binding] = ParameterMetadata(
            binding, "internal", data_type, False, has_value=True
        )
        return self.dialect.placeholder(binding)

    def declared(self, parameter_id: str) -> str:
        existing = self._declared.get(parameter_id)
        if existing:
            return self.dialect.placeholder(existing)
        try:
            definition = self.definitions[parameter_id]
        except KeyError as error:
            raise PublicError(
                "QUERY_PARAMETER_BINDING_FAILED", "El parámetro declarado no existe.", 422
            ) from error
        binding = self._next()
        has_value = parameter_id in self.preview_values
        if has_value:
            self.values[binding] = self.preview_values[parameter_id]
        self.metadata[binding] = ParameterMetadata(
            binding,
            "parameter",
            definition.data_type,
            definition.sensitive,
            parameter_id=parameter_id,
            has_value=has_value,
        )
        self._declared[parameter_id] = binding
        return self.dialect.placeholder(binding)
