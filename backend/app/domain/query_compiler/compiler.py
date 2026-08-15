import hashlib
import json
import uuid
from dataclasses import asdict

from app.domain.connections.errors import PublicError
from app.domain.query_compiler.base import QueryCompiler
from app.domain.query_compiler.dialect import MySQLDialect
from app.domain.query_compiler.models import (
    COMPILER_VERSION,
    CompilationContext,
    CompilationResult,
    CompilationWarning,
)
from app.domain.query_compiler.registries import AliasRegistry, ParameterRegistry
from app.domain.query_model.ast import (
    AggregateExpression,
    BetweenPredicate,
    BinaryExpression,
    BooleanExpressionPredicate,
    CaseExpression,
    CastExpression,
    ComparisonPredicate,
    ExistsPredicate,
    Expression,
    FieldReference,
    FunctionExpression,
    GroupByItem,
    InPredicate,
    IsNullPredicate,
    JoinNode,
    LikePredicate,
    LiteralNode,
    LogicalGroupPredicate,
    NotPredicate,
    OuterFieldReference,
    ParameterReference,
    Predicate,
    QueryBody,
    SourceNode,
    SubqueryExpression,
    UnaryExpression,
)
from app.domain.query_model.validation import collect_references


class MySQLQueryCompiler(QueryCompiler):
    def compile(self, context: CompilationContext) -> CompilationResult:
        if context.connection.engine != "mysql":
            raise PublicError("QUERY_COMPILER_NOT_FOUND", "El compilador requiere MySQL.", 400)
        if (context.connection.major_version or 0) < 5:
            raise PublicError(
                "QUERY_MYSQL_VERSION_UNSUPPORTED", "La versión de MySQL no está soportada.", 422
            )
        self.context = context
        self.dialect = MySQLDialect()
        self.aliases = AliasRegistry(self.dialect)
        self.parameters = ParameterRegistry(
            self.dialect,
            context.query.parameters,
            context.options.preview_values,
            maximum=context.options.max_bound_parameters,
        )
        self.warnings: list[CompilationWarning] = []
        self.capabilities: set[str] = set()
        self.source_entities: dict[tuple[str, str], uuid.UUID] = {}
        self.scope_logical: dict[str, str] = {}
        self.scope_counter = 0
        sql = self._body(context.query.query, outer_scopes={})
        refs, _ = collect_references(context.query)
        if context.connection.provider == "mariadb":
            self.warnings.append(
                CompilationWarning(
                    "QUERY_PROVIDER_COMPILATION_WARNING",
                    "MariaDB utiliza un perfil de compatibilidad limitado; revise la vista previa.",
                )
            )
        compilation_fingerprint = self._fingerprint(sql)
        return CompilationResult(
            success=True,
            engine=context.connection.engine,
            provider=context.connection.provider,
            server_version=context.connection.raw_version,
            dialect=self.dialect.name,
            compiler_version=COMPILER_VERSION,
            sql=sql,
            parameters=dict(self.parameters.values),
            parameter_metadata=dict(self.parameters.metadata),
            warnings=tuple(self.warnings),
            errors=(),
            capabilities_used=tuple(sorted(self.capabilities)),
            referenced_entities=tuple(sorted(refs.entities, key=str)),
            referenced_fields=tuple(sorted(refs.fields, key=str)),
            referenced_relationships=tuple(sorted(refs.relationships, key=str)),
            query_fingerprint=context.query_fingerprint,
            compilation_fingerprint=compilation_fingerprint,
            complexity=context.complexity,
        )

    def _fingerprint(self, sql: str) -> str:
        payload = {
            "compiler": COMPILER_VERSION,
            "engine": self.context.connection.engine,
            "provider": self.context.connection.provider,
            "version": [
                self.context.connection.major_version,
                self.context.connection.minor_version,
            ],
            "capabilities": self.context.connection.capabilities,
            "query": self.context.query_fingerprint,
            "sql": sql,
            "parameters": [asdict(item) for item in self.parameters.metadata.values()],
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(encoded.encode()).hexdigest()

    def _entity(self, entity_id: uuid.UUID) -> tuple[str, str]:
        entity = self.context.catalog.entities.get(entity_id)
        if entity is None or not entity.is_active:
            raise PublicError(
                "QUERY_IDENTIFIER_RESOLUTION_FAILED", "La entidad no está disponible.", 422
            )
        return entity.schema_name, entity.physical_name

    def _field(self, field_id: uuid.UUID, expected_entity: uuid.UUID) -> str:
        field = self.context.catalog.fields.get(field_id)
        if field is None or not field.is_active or field.entity_id != expected_entity:
            raise PublicError(
                "QUERY_IDENTIFIER_RESOLUTION_FAILED", "El campo no está disponible.", 422
            )
        return self.dialect.quote_identifier(field.physical_name)

    def _source(self, source: SourceNode, scope_id: str) -> str:
        schema, table = self._entity(source.entity_id)
        alias = self.aliases.register(scope_id, source.source_id, source.alias)
        self.source_entities[(scope_id, source.source_id)] = source.entity_id
        return (
            f"{self.dialect.quote_identifier(schema)}."
            f"{self.dialect.quote_identifier(table)} AS {alias}"
        )

    def _body(self, body: QueryBody, *, outer_scopes: dict[str, str]) -> str:
        self.scope_counter += 1
        scope_id = f"{body.scope_id}__{self.scope_counter}"
        self.scope_logical[scope_id] = body.scope_id
        self._validate_grouping(body)
        source_sql = self._source(body.source, scope_id)
        joined_sources = {join.join_id: self._source(join.source, scope_id) for join in body.joins}
        select_sql = ",\n    ".join(
            self._select(item.expression, item.alias, scope_id, outer_scopes)
            for item in body.select
        )
        clauses = [
            f"SELECT{' DISTINCT' if body.distinct else ''}\n    {select_sql}",
            f"FROM {source_sql}",
        ]
        for join in body.joins:
            clauses.append(self._join(join, joined_sources[join.join_id], scope_id, outer_scopes))
        if body.where is not None:
            clauses.append(f"WHERE {self._predicate(body.where, scope_id, outer_scopes)}")
        if body.group_by:
            clauses.append(
                "GROUP BY\n    "
                + ",\n    ".join(
                    self._group_by_expression(item, body, scope_id, outer_scopes)
                    for item in body.group_by
                )
            )
        if body.having is not None:
            clauses.append(f"HAVING {self._predicate(body.having, scope_id, outer_scopes)}")
        sql = "\n".join(clauses)
        for union in body.unions:
            self._require_capability("supports_union")
            operation = "UNION ALL" if union.operation == "union_all" else "UNION"
            branch = self._body(union.query, outer_scopes=outer_scopes)
            sql = f"({sql})\n{operation}\n({branch})"
        if body.order_by:
            ordering: list[str] = []
            for item in body.order_by:
                expression = self._expression(item.expression, scope_id, outer_scopes)
                direction = "ASC" if item.direction == "ascending" else "DESC"
                if item.nulls != "engine_default":
                    null_direction = "DESC" if item.nulls == "first" else "ASC"
                    ordering.append(f"({expression} IS NULL) {null_direction}")
                ordering.append(f"{expression} {direction}")
            sql += "\nORDER BY\n    " + ",\n    ".join(ordering)
        if body.limit is not None:
            sql += f"\nLIMIT {self.parameters.internal(body.limit, 'integer')}"
        if body.offset is not None:
            sql += f"\nOFFSET {self.parameters.internal(body.offset, 'integer')}"
        return sql

    def _select(
        self,
        expression: Expression,
        alias: str | None,
        scope_id: str,
        outer_scopes: dict[str, str],
    ) -> str:
        sql = self._expression(expression, scope_id, outer_scopes)
        return f"{sql} AS {self.dialect.quote_identifier(alias)}" if alias else sql

    def _expression(
        self, expression: Expression, scope_id: str, outer_scopes: dict[str, str]
    ) -> str:
        if isinstance(expression, FieldReference):
            entity_id = self.source_entities.get((scope_id, expression.source_id))
            if entity_id is None:
                raise PublicError("QUERY_IDENTIFIER_RESOLUTION_FAILED", "Source desconocido.", 422)
            return (
                f"{self.aliases.resolve(scope_id, expression.source_id)}."
                f"{self._field(expression.field_id, entity_id)}"
            )
        if isinstance(expression, OuterFieldReference):
            outer_scope = outer_scopes.get(expression.scope_id)
            if outer_scope is None:
                raise PublicError(
                    "QUERY_CORRELATION_COMPILATION_FAILED",
                    "La referencia correlacionada apunta a un scope no permitido.",
                    422,
                )
            entity_id = self.source_entities.get((outer_scope, expression.source_id))
            if entity_id is None:
                raise PublicError(
                    "QUERY_CORRELATION_COMPILATION_FAILED", "Source externo desconocido.", 422
                )
            return (
                f"{self.aliases.resolve(outer_scope, expression.source_id)}."
                f"{self._field(expression.field_id, entity_id)}"
            )
        if isinstance(expression, LiteralNode):
            if expression.value_type == "null":
                return "NULL"
            return self.parameters.literal(expression.value, expression.value_type)
        if isinstance(expression, ParameterReference):
            return self.parameters.declared(expression.parameter_id)
        if isinstance(expression, BinaryExpression):
            operator = {
                "add": "+",
                "subtract": "-",
                "multiply": "*",
                "divide": "/",
                "modulo": "%",
            }[expression.operator]
            return (
                f"({self._expression(expression.left, scope_id, outer_scopes)} {operator} "
                f"{self._expression(expression.right, scope_id, outer_scopes)})"
            )
        if isinstance(expression, UnaryExpression):
            operator = "-" if expression.operator == "negate" else "+"
            return f"({operator}{self._expression(expression.operand, scope_id, outer_scopes)})"
        if isinstance(expression, FunctionExpression):
            return self._function(expression, scope_id, outer_scopes)
        if isinstance(expression, AggregateExpression):
            return self._aggregate(expression, scope_id, outer_scopes)
        if isinstance(expression, CaseExpression):
            branches = " ".join(
                f"WHEN {self._predicate(item.when, scope_id, outer_scopes)} "
                f"THEN {self._expression(item.then, scope_id, outer_scopes)}"
                for item in expression.branches
            )
            fallback = (
                f" ELSE {self._expression(expression.else_expression, scope_id, outer_scopes)}"
                if expression.else_expression is not None
                else ""
            )
            return f"(CASE {branches}{fallback} END)"
        if isinstance(expression, CastExpression):
            value = self._expression(expression.expression, scope_id, outer_scopes)
            return f"CAST({value} AS {self.dialect.cast(expression.target_type)})"
        if isinstance(expression, SubqueryExpression):
            self._require_capability("supports_subqueries")
            nested_scopes = {**outer_scopes, self.scope_logical[scope_id]: scope_id}
            sql = self._body(expression.query, outer_scopes=nested_scopes)
            return f"({sql})"
        raise PublicError("QUERY_COMPILATION_FAILED", "Expresión no soportada.", 422)

    def _function(
        self, expression: FunctionExpression, scope_id: str, outer_scopes: dict[str, str]
    ) -> str:
        arguments = [
            self._expression(item, scope_id, outer_scopes) for item in expression.arguments
        ]
        if expression.function in {"date_add", "date_subtract"}:
            unit = str(expression.options.get("unit", "")).casefold()
            if unit not in self.dialect.INTERVAL_UNITS or len(arguments) != 2:
                raise PublicError(
                    "QUERY_FUNCTION_COMPILATION_UNSUPPORTED",
                    "La función de fecha requiere una unidad controlada.",
                    422,
                )
            name = "DATE_ADD" if expression.function == "date_add" else "DATE_SUB"
            return f"{name}({arguments[0]}, INTERVAL {arguments[1]} {unit.upper()})"
        name = self.dialect.function(expression.function)
        return name if not arguments else f"{name}({', '.join(arguments)})"

    def _aggregate(
        self, expression: AggregateExpression, scope_id: str, outer_scopes: dict[str, str]
    ) -> str:
        names = {
            "count": "COUNT",
            "count_all": "COUNT",
            "sum": "SUM",
            "average": "AVG",
            "minimum": "MIN",
            "maximum": "MAX",
            "group_concat": "GROUP_CONCAT",
        }
        argument = (
            "*"
            if expression.argument is None
            else self._expression(expression.argument, scope_id, outer_scopes)
        )
        if expression.filter is not None:
            condition = self._predicate(expression.filter, scope_id, outer_scopes)
            if expression.aggregate in {"count", "count_all"}:
                return f"SUM(CASE WHEN {condition} THEN 1 ELSE 0 END)"
            if expression.aggregate == "sum":
                return f"SUM(CASE WHEN {condition} THEN {argument} ELSE 0 END)"
            raise PublicError(
                "QUERY_FUNCTION_COMPILATION_UNSUPPORTED",
                "El filtro de esta agregación no puede reescribirse de forma segura.",
                422,
            )
        distinct = "DISTINCT " if expression.distinct else ""
        return f"{names[expression.aggregate]}({distinct}{argument})"

    def _predicate(self, predicate: Predicate, scope_id: str, outer_scopes: dict[str, str]) -> str:
        if isinstance(predicate, ComparisonPredicate):
            operator = {
                "equals": "=",
                "not_equals": "<>",
                "greater_than": ">",
                "greater_than_or_equal": ">=",
                "less_than": "<",
                "less_than_or_equal": "<=",
            }[predicate.operator]
            return (
                f"({self._expression(predicate.left, scope_id, outer_scopes)} {operator} "
                f"{self._expression(predicate.right, scope_id, outer_scopes)})"
            )
        if isinstance(predicate, LogicalGroupPredicate):
            operator = " AND " if predicate.operator == "and" else " OR "
            return (
                "("
                + operator.join(
                    self._predicate(item, scope_id, outer_scopes) for item in predicate.conditions
                )
                + ")"
            )
        if isinstance(predicate, NotPredicate):
            return f"NOT ({self._predicate(predicate.condition, scope_id, outer_scopes)})"
        if isinstance(predicate, IsNullPredicate):
            suffix = "IS NOT NULL" if predicate.negated else "IS NULL"
            return f"({self._expression(predicate.expression, scope_id, outer_scopes)} {suffix})"
        if isinstance(predicate, BetweenPredicate):
            negated = " NOT" if predicate.negated else ""
            return (
                f"({self._expression(predicate.expression, scope_id, outer_scopes)}"
                f"{negated} BETWEEN "
                f"{self._expression(predicate.lower, scope_id, outer_scopes)} AND "
                f"{self._expression(predicate.upper, scope_id, outer_scopes)})"
            )
        if isinstance(predicate, InPredicate):
            negated = " NOT" if predicate.negated else ""
            if predicate.values is not None:
                values = ", ".join(
                    self._expression(item, scope_id, outer_scopes) for item in predicate.values
                )
            elif predicate.subquery is not None:
                values = self._expression(predicate.subquery, scope_id, outer_scopes)[1:-1]
            else:
                raise PublicError("QUERY_COMPILATION_FAILED", "IN no contiene valores.", 422)
            return (
                f"({self._expression(predicate.expression, scope_id, outer_scopes)}"
                f"{negated} IN ({values}))"
            )
        if isinstance(predicate, LikePredicate):
            left = self._expression(predicate.expression, scope_id, outer_scopes)
            pattern = self._expression(predicate.pattern, scope_id, outer_scopes)
            if not predicate.case_sensitive:
                left, pattern = f"LOWER({left})", f"LOWER({pattern})"
            negated = " NOT" if predicate.negated else ""
            escape = (
                f" ESCAPE {self.parameters.literal(predicate.escape_character, 'string')}"
                if predicate.escape_character
                else ""
            )
            return f"({left}{negated} LIKE {pattern}{escape})"
        if isinstance(predicate, ExistsPredicate):
            self._require_capability("supports_subqueries")
            query = self._expression(predicate.query, scope_id, outer_scopes)
            return f"{'NOT ' if predicate.negated else ''}EXISTS {query}"
        if isinstance(predicate, BooleanExpressionPredicate):
            return f"({self._expression(predicate.expression, scope_id, outer_scopes)})"
        raise PublicError("QUERY_COMPILATION_FAILED", "Predicado no soportado.", 422)

    def _join(
        self,
        join: JoinNode,
        joined_sql: str,
        scope_id: str,
        outer_scopes: dict[str, str],
    ) -> str:
        self._require_capability("supports_joins")
        joined_entity = join.source.entity_id
        join_keyword = {
            "inner": "INNER JOIN",
            "left": "LEFT JOIN",
            "right": "RIGHT JOIN",
            "cross": "CROSS JOIN",
        }[join.join_type]
        if join.join_type == "cross":
            if join.on is not None or join.relationship_id is not None:
                raise PublicError("QUERY_JOIN_COMPILATION_FAILED", "CROSS JOIN no acepta ON.", 422)
            self.warnings.append(
                CompilationWarning(
                    "QUERY_CROSS_JOIN_WARNING",
                    "CROSS JOIN puede multiplicar las filas del resultado.",
                )
            )
            return f"{join_keyword} {joined_sql}"
        if join.relationship_id is not None:
            on = self._relationship_on(join, joined_entity, scope_id)
        elif join.on is not None:
            on = self._predicate(join.on, scope_id, outer_scopes)
        else:
            raise PublicError("QUERY_JOIN_COMPILATION_FAILED", "JOIN no contiene condición.", 422)
        return f"{join_keyword} {joined_sql}\n    ON {on}"

    def _relationship_on(self, join: JoinNode, joined_entity: uuid.UUID, scope_id: str) -> str:
        relationship_id = join.relationship_id
        assert relationship_id is not None
        polymorphic = self.context.catalog.polymorphic_relationships.get(relationship_id)
        if polymorphic is not None:
            return self._polymorphic_on(join, polymorphic.id, joined_entity, scope_id)
        relationship = self.context.catalog.relationships.get(relationship_id)
        if relationship is None or not relationship.enabled or not relationship.pairs:
            raise PublicError(
                "QUERY_JOIN_COMPILATION_FAILED", "La relación no puede utilizarse.", 422
            )
        if joined_entity not in {relationship.source_entity_id, relationship.target_entity_id}:
            raise PublicError(
                "QUERY_JOIN_COMPILATION_FAILED",
                "La entidad del join no pertenece a la relación.",
                422,
            )
        other_entity = (
            relationship.target_entity_id
            if joined_entity == relationship.source_entity_id
            else relationship.source_entity_id
        )
        other_source = self._source_for_entity(
            scope_id, other_entity, exclude=join.source.source_id
        )
        if joined_entity == relationship.source_entity_id:
            source_id, target_id = join.source.source_id, other_source
        else:
            source_id, target_id = other_source, join.source.source_id
        source_alias = self.aliases.resolve(scope_id, source_id)
        target_alias = self.aliases.resolve(scope_id, target_id)
        conditions: list[str] = []
        for pair in relationship.pairs:
            conditions.append(
                f"{source_alias}."
                f"{self._field(pair.source_field_id, relationship.source_entity_id)} = "
                f"{target_alias}."
                f"{self._field(pair.target_field_id, relationship.target_entity_id)}"
            )
        return "(" + " AND ".join(conditions) + ")"

    def _polymorphic_on(
        self, join: JoinNode, relationship_id: uuid.UUID, joined_entity: uuid.UUID, scope_id: str
    ) -> str:
        relationship = self.context.catalog.polymorphic_relationships[relationship_id]
        mapping = (
            self.context.catalog.polymorphic_mappings.get(join.polymorphic_mapping_id)
            if join.polymorphic_mapping_id
            else None
        )
        if (
            not relationship.enabled
            or mapping is None
            or not mapping.enabled
            or mapping.relationship_id != relationship.id
            or mapping.target_entity_id != joined_entity
        ):
            raise PublicError(
                "QUERY_POLYMORPHIC_JOIN_INVALID",
                "El mapping polimórfico no es válido para este join.",
                422,
            )
        source_id = self._source_for_entity(
            scope_id, relationship.source_entity_id, exclude=join.source.source_id
        )
        source_alias = self.aliases.resolve(scope_id, source_id)
        target_alias = self.aliases.resolve(scope_id, join.source.source_id)
        id_condition = (
            f"{source_alias}."
            f"{self._field(relationship.id_field_id, relationship.source_entity_id)} = "
            f"{target_alias}.{self._field(mapping.target_field_id, mapping.target_entity_id)}"
        )
        discriminator = self.parameters.internal(mapping.type_value, "string")
        type_condition = (
            f"{source_alias}."
            f"{self._field(relationship.type_field_id, relationship.source_entity_id)}"
            f" = {discriminator}"
        )
        return f"({id_condition} AND {type_condition})"

    def _source_for_entity(self, scope_id: str, entity_id: uuid.UUID, *, exclude: str) -> str:
        matches = [
            source_id
            for (source_scope, source_id), value in self.source_entities.items()
            if source_scope == scope_id and source_id != exclude and value == entity_id
        ]
        if len(matches) != 1:
            raise PublicError(
                "QUERY_JOIN_COMPILATION_FAILED",
                "No fue posible determinar la dirección de la relación.",
                422,
            )
        return matches[0]

    def _validate_grouping(self, body: QueryBody) -> None:
        grouped = {
            json.dumps(item.expression.model_dump(mode="json"), sort_keys=True, default=str)
            for item in body.group_by
        }
        grouped_positions = {item.position for item in body.group_by if item.position is not None}
        if any(position > len(body.select) for position in grouped_positions):
            raise PublicError(
                "QUERY_GROUPING_INVALID",
                "Una posición de GROUP BY no corresponde a una expresión SELECT.",
                422,
            )
        has_aggregate = any(
            self._contains_aggregate(item.expression.model_dump(mode="json"))
            for item in body.select
        )
        if not grouped and not has_aggregate:
            return
        for index, item in enumerate(body.select, start=1):
            expression = item.expression.model_dump(mode="json")
            if self._contains_aggregate(expression) or expression.get("node_type") in {
                "literal",
                "parameter",
            }:
                continue
            key = json.dumps(expression, sort_keys=True, default=str)
            if key not in grouped and index not in grouped_positions:
                raise PublicError(
                    "QUERY_GROUPING_INVALID",
                    "Una expresión seleccionada no agregada debe aparecer en GROUP BY.",
                    422,
                )

    def _group_by_expression(
        self,
        item: GroupByItem,
        body: QueryBody,
        scope_id: str,
        outer_scopes: dict[str, str],
    ) -> str:
        if item.position is not None:
            return str(item.position)
        if not isinstance(item.expression, FieldReference):
            grouped = item.expression.model_dump(mode="json")
            for index, selected in enumerate(body.select, start=1):
                if selected.expression.model_dump(mode="json") == grouped:
                    return str(index)
        return self._expression(item.expression, scope_id, outer_scopes)

    def _contains_aggregate(self, value: object) -> bool:
        if isinstance(value, dict):
            if value.get("node_type") == "aggregate":
                return True
            return any(self._contains_aggregate(child) for child in value.values())
        if isinstance(value, list):
            return any(self._contains_aggregate(child) for child in value)
        return False

    def _require_capability(self, capability: str) -> None:
        if not self.context.connection.capabilities.get(capability, False):
            raise PublicError(
                "QUERY_CAPABILITY_NOT_SUPPORTED",
                f"La conexión no soporta {capability}.",
                422,
            )
        self.capabilities.add(capability)
