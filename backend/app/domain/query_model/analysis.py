import hashlib
import json
from dataclasses import dataclass
from typing import Any

from app.domain.query_model.ast import UniversalQuery


@dataclass(frozen=True)
class QueryComplexity:
    score: int
    level: str
    metrics: dict[str, int]


def walk(value: Any, *, depth: int = 0) -> tuple[int, int, dict[str, int]]:
    nodes, maximum = 1, depth
    metrics = {
        "joins": 0,
        "subqueries": 0,
        "predicates": 0,
        "functions": 0,
        "aggregates": 0,
        "unions": 0,
    }
    if isinstance(value, dict):
        kind = value.get("node_type")
        if kind in {
            "comparison",
            "logical_group",
            "not",
            "is_null",
            "between",
            "in",
            "exists",
            "like",
            "boolean_expression",
        }:
            metrics["predicates"] += 1
        if kind == "subquery":
            metrics["subqueries"] += 1
        if kind == "function":
            metrics["functions"] += 1
        if kind == "aggregate":
            metrics["aggregates"] += 1
        metrics["joins"] += (
            len(value.get("joins", [])) if isinstance(value.get("joins"), list) else 0
        )
        metrics["unions"] += (
            len(value.get("unions", [])) if isinstance(value.get("unions"), list) else 0
        )
        for child in value.values():
            child_nodes, child_depth, child_metrics = walk(child, depth=depth + 1)
            nodes += child_nodes
            maximum = max(maximum, child_depth)
            for key, count in child_metrics.items():
                metrics[key] += count
    elif isinstance(value, list):
        for child in value:
            child_nodes, child_depth, child_metrics = walk(child, depth=depth + 1)
            nodes += child_nodes
            maximum = max(maximum, child_depth)
            for key, count in child_metrics.items():
                metrics[key] += count
    return nodes, maximum, metrics


def calculate_complexity(query: UniversalQuery) -> QueryComplexity:
    document = query.model_dump(mode="json")
    nodes, depth, metrics = walk(document)
    metrics.update(
        {
            "nodes": nodes,
            "depth": depth,
            "select_items": len(query.query.select),
            "parameters": len(query.parameters),
        }
    )
    score = (
        len(query.query.select)
        + metrics["predicates"] * 2
        + metrics["joins"] * 5
        + metrics["subqueries"] * 8
        + metrics["unions"] * 7
        + metrics["functions"]
        + metrics["aggregates"] * 2
    )
    level = (
        "low" if score < 20 else "medium" if score < 50 else "high" if score < 100 else "very_high"
    )
    return QueryComplexity(score, level, metrics)


def normalized_document(query: UniversalQuery) -> dict[str, Any]:
    return query.model_dump(mode="json", exclude_none=True)


def query_fingerprint(query: UniversalQuery) -> str:
    document = normalized_document(query)
    document.pop("metadata", None)
    for parameter in document.get("parameters", []):
        parameter.pop("default_value", None)
    payload = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()
