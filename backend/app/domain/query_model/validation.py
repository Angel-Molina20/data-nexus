import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.config import Settings
from app.domain.query_model.analysis import (
    QueryComplexity,
    calculate_complexity,
    normalized_document,
)
from app.domain.query_model.ast import UniversalQuery
from app.domain.query_model.functions import FUNCTIONS


@dataclass(frozen=True)
class QueryValidationIssue:
    code: str
    message: str
    severity: str
    path: str
    node_id: str | None = None
    details: dict[str, str | int | bool] | None = None


@dataclass
class QueryReferences:
    entities: set[uuid.UUID] = field(default_factory=set)
    fields: set[uuid.UUID] = field(default_factory=set)
    relationships: set[uuid.UUID] = field(default_factory=set)
    mappings: set[uuid.UUID] = field(default_factory=set)
    sources: dict[str, uuid.UUID] = field(default_factory=dict)


def collect_references(query: UniversalQuery) -> tuple[QueryReferences, list[QueryValidationIssue]]:
    refs, issues = QueryReferences(), []
    parameters = {item.parameter_id for item in query.parameters}
    if len(parameters) != len(query.parameters):
        issues.append(
            QueryValidationIssue(
                "QUERY_PARAMETER_DUPLICATE",
                "Los parámetros deben tener identificadores únicos.",
                "error",
                "parameters",
            )
        )

    def body(value: dict[str, Any], path: str, outer_sources: set[str]) -> None:
        source = value["source"]
        local: dict[str, str] = {source["source_id"]: source["alias"]}
        refs.entities.add(uuid.UUID(source["entity_id"]))
        for index, join in enumerate(value.get("joins", [])):
            joined = join["source"]
            if joined["source_id"] in local or joined["alias"] in local.values():
                issues.append(
                    QueryValidationIssue(
                        "QUERY_SOURCE_ALIAS_DUPLICATE",
                        "Los source_id y alias deben ser únicos.",
                        "error",
                        f"{path}.joins[{index}].source",
                    )
                )
            local[joined["source_id"]] = joined["alias"]
            refs.entities.add(uuid.UUID(joined["entity_id"]))
            if join.get("relationship_id"):
                refs.relationships.add(uuid.UUID(join["relationship_id"]))
            if join.get("polymorphic_mapping_id"):
                refs.mappings.add(uuid.UUID(join["polymorphic_mapping_id"]))
        refs.sources.update(
            {key: uuid.UUID(source["entity_id"]) for key, source in [(source["source_id"], source)]}
        )
        refs.sources.update(
            {
                join["source"]["source_id"]: uuid.UUID(join["source"]["entity_id"])
                for join in value.get("joins", [])
            }
        )
        scan(value, path, set(local) | outer_sources)

    def scan(value: Any, path: str, available_sources: set[str]) -> None:
        if isinstance(value, dict):
            kind = value.get("node_type")
            if kind == "field":
                refs.fields.add(uuid.UUID(value["field_id"]))
                if value["source_id"] not in available_sources:
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_SOURCE_NOT_FOUND",
                            "La referencia usa un source inexistente.",
                            "error",
                            path,
                        )
                    )
            elif kind == "outer_field":
                refs.fields.add(uuid.UUID(value["field_id"]))
                if value["source_id"] not in available_sources:
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_OUTER_REFERENCE_INVALID",
                            "La referencia externa no pertenece a un scope disponible.",
                            "error",
                            path,
                        )
                    )
            elif kind == "parameter" and value["parameter_id"] not in parameters:
                issues.append(
                    QueryValidationIssue(
                        "QUERY_PARAMETER_NOT_FOUND",
                        "El parámetro referenciado no existe.",
                        "error",
                        path,
                    )
                )
            elif kind == "subquery":
                body(value["query"], f"{path}.query", available_sources)
                return
            for key, child in value.items():
                scan(child, f"{path}.{key}", available_sources)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                scan(child, f"{path}[{index}]", available_sources)

    body(query.query.model_dump(mode="json", exclude_none=True), "query", set())
    return refs, issues


def validate_limits(query: UniversalQuery, settings: Settings) -> list[QueryValidationIssue]:
    issues: list[QueryValidationIssue] = []
    complexity = calculate_complexity(query)
    metrics = complexity.metrics
    limits = {
        "nodes": settings.QUERY_MAX_TOTAL_NODES,
        "joins": settings.QUERY_MAX_JOINS,
        "select_items": settings.QUERY_MAX_SELECT_ITEMS,
        "parameters": settings.QUERY_MAX_PARAMETERS,
        "unions": settings.QUERY_MAX_UNIONS,
    }
    for metric, maximum in limits.items():
        if metrics.get(metric, 0) > maximum:
            issues.append(
                QueryValidationIssue(
                    "QUERY_NODE_LIMIT_EXCEEDED",
                    f"La consulta supera el límite de {metric}.",
                    "error",
                    "query",
                    details={"maximum": maximum},
                )
            )
    if query.query.limit is not None and query.query.limit > settings.QUERY_MAX_DECLARED_LIMIT:
        issues.append(
            QueryValidationIssue(
                "QUERY_NODE_LIMIT_EXCEEDED",
                "El límite declarado excede el máximo permitido.",
                "error",
                "query.limit",
                details={"maximum": settings.QUERY_MAX_DECLARED_LIMIT},
            )
        )
    document = normalized_document(query)
    maximums = {"expression": 0, "predicate": 0, "subquery": 0}

    def inspect(
        value: Any,
        expression_depth: int = 0,
        predicate_depth: int = 0,
        subquery_depth: int = 0,
        path: str = "query",
    ) -> None:
        if isinstance(value, dict):
            kind = value.get("node_type")
            expression_kinds = {
                "field",
                "outer_field",
                "literal",
                "parameter",
                "binary",
                "unary",
                "function",
                "aggregate",
                "case",
                "cast",
                "subquery",
            }
            predicate_kinds = {
                "comparison",
                "logical_group",
                "not",
                "is_null",
                "between",
                "in",
                "exists",
                "like",
                "boolean_expression",
            }
            next_expression = expression_depth + (1 if kind in expression_kinds else 0)
            next_predicate = predicate_depth + (1 if kind in predicate_kinds else 0)
            next_subquery = subquery_depth + (1 if kind == "subquery" else 0)
            maximums["expression"] = max(maximums["expression"], next_expression)
            maximums["predicate"] = max(maximums["predicate"], next_predicate)
            maximums["subquery"] = max(maximums["subquery"], next_subquery)
            if (
                kind == "in"
                and isinstance(value.get("values"), list)
                and len(value["values"]) > settings.QUERY_MAX_IN_VALUES
            ):
                issues.append(
                    QueryValidationIssue(
                        "QUERY_NODE_LIMIT_EXCEEDED",
                        "IN supera la cantidad máxima de valores.",
                        "error",
                        path,
                        details={"maximum": settings.QUERY_MAX_IN_VALUES},
                    )
                )
            if kind == "function":
                signature = FUNCTIONS.get(str(value.get("function")))
                arguments = value.get("arguments", [])
                if (
                    signature is None
                    or not isinstance(arguments, list)
                    or not signature.minimum_arguments
                    <= len(arguments)
                    <= signature.maximum_arguments
                ):
                    issues.append(
                        QueryValidationIssue(
                            "QUERY_FUNCTION_ARGUMENT_INVALID",
                            "La función no tiene una cantidad válida de argumentos.",
                            "error",
                            path,
                        )
                    )
            for key, child in value.items():
                inspect(child, next_expression, next_predicate, next_subquery, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                inspect(
                    child, expression_depth, predicate_depth, subquery_depth, f"{path}[{index}]"
                )

    inspect(document)
    for key, maximum in (
        ("expression", settings.QUERY_MAX_EXPRESSION_DEPTH),
        ("predicate", settings.QUERY_MAX_PREDICATE_DEPTH),
        ("subquery", settings.QUERY_MAX_SUBQUERY_DEPTH),
    ):
        if maximums[key] > maximum:
            issues.append(
                QueryValidationIssue(
                    "QUERY_DEPTH_LIMIT_EXCEEDED",
                    f"La profundidad de {key} supera el máximo.",
                    "error",
                    "query",
                    details={"maximum": maximum},
                )
            )
    for index, union in enumerate(query.query.unions):
        if len(union.query.select) != len(query.query.select):
            issues.append(
                QueryValidationIssue(
                    "QUERY_UNION_COLUMN_MISMATCH",
                    "Las consultas de UNION deben seleccionar igual cantidad de columnas.",
                    "error",
                    f"query.unions[{index}]",
                )
            )
    if len(str(document).encode()) > settings.QUERY_MAX_DOCUMENT_SIZE_KB * 1024:
        issues.append(
            QueryValidationIssue(
                "QUERY_NODE_LIMIT_EXCEEDED",
                "El documento excede el tamaño máximo.",
                "error",
                "query",
            )
        )
    return issues


def result_complexity(query: UniversalQuery) -> QueryComplexity:
    return calculate_complexity(query)
