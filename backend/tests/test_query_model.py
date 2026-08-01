import uuid

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import UniversalQuery
from app.domain.query_model.validation import collect_references, validate_limits


def minimal_document() -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "connection_id": str(uuid.uuid4()),
        "query": {
            "scope_id": "root",
            "source": {
                "source_id": "src_students",
                "entity_id": str(uuid.uuid4()),
                "alias": "students",
            },
            "select": [
                {
                    "select_id": "item_1",
                    "item_type": "literal",
                    "expression": {"node_type": "literal", "value_type": "integer", "value": 1},
                }
            ],
        },
    }


def test_minimal_query_normalization_and_fingerprint_are_deterministic() -> None:
    query = UniversalQuery.model_validate(minimal_document())
    assert normalized_document(query)["schema_version"] == "1.0"
    assert query_fingerprint(query) == query_fingerprint(query.model_copy(deep=True))
    assert calculate_complexity(query).level == "low"
    assert validate_limits(query, get_settings()) == []


def test_builder_layout_is_validated_without_changing_logical_fingerprint() -> None:
    base = UniversalQuery.model_validate(minimal_document())
    document = minimal_document()
    document["connection_id"] = str(base.connection_id)
    query_body = document["query"]
    assert isinstance(query_body, dict)
    query_body["source"] = base.query.source.model_dump(mode="json")
    document["metadata"] = {
        "created_from": "future_visual_builder",
        "builder_layout": {
            "nodes": {"src_students": {"x": 120, "y": 80, "collapsed": False}},
            "panels": {"catalog_width": 300, "inspector_width": 380},
        },
    }
    with_layout = UniversalQuery.model_validate(document)
    assert with_layout.metadata.builder_layout is not None
    assert query_fingerprint(base) == query_fingerprint(with_layout)

    invalid = minimal_document()
    invalid["metadata"] = {"builder_layout": {"nodes": {"src_students": {"x": 999999, "y": 0}}}}
    with pytest.raises(ValidationError):
        UniversalQuery.model_validate(invalid)


def test_unknown_schema_version_is_rejected() -> None:
    document = minimal_document()
    document["schema_version"] = "99.0"
    with pytest.raises(ValidationError, match="QUERY_SCHEMA_VERSION_UNSUPPORTED"):
        UniversalQuery.model_validate(document)


def test_predicates_parameters_aggregate_subquery_and_union() -> None:
    document = minimal_document()
    query_body = document["query"]
    assert isinstance(query_body, dict)
    query_body["where"] = {
        "node_type": "logical_group",
        "operator": "and",
        "conditions": [
            {
                "node_type": "between",
                "expression": {"node_type": "parameter", "parameter_id": "age"},
                "lower": {"node_type": "literal", "value_type": "integer", "value": 18},
                "upper": {"node_type": "literal", "value_type": "integer", "value": 65},
            },
            {
                "node_type": "not",
                "condition": {
                    "node_type": "is_null",
                    "expression": {"node_type": "parameter", "parameter_id": "age"},
                },
            },
        ],
    }
    query_body["select"] = [
        {
            "select_id": "count_1",
            "item_type": "aggregate",
            "expression": {"node_type": "aggregate", "aggregate": "count_all", "distinct": False},
        }
    ]
    query_body["unions"] = [
        {"union_id": "union_1", "operation": "union_all", "query": minimal_document()["query"]}
    ]
    document["parameters"] = [
        {"parameter_id": "age", "name": "age", "label": "Edad", "data_type": "integer"}
    ]
    query = UniversalQuery.model_validate(document)
    refs, issues = collect_references(query)
    assert not issues
    assert len(refs.entities) >= 1
    assert calculate_complexity(query).metrics["unions"] == 1


def test_in_requires_exactly_one_value_source() -> None:
    document = minimal_document()
    body = document["query"]
    assert isinstance(body, dict)
    body["where"] = {
        "node_type": "in",
        "expression": {"node_type": "literal", "value_type": "integer", "value": 1},
        "values": [],
        "subquery": None,
    }
    with pytest.raises(ValidationError, match="lista vacía"):
        UniversalQuery.model_validate(document)


def test_sensitive_parameter_cannot_store_default() -> None:
    document = minimal_document()
    document["parameters"] = [
        {
            "parameter_id": "secret",
            "name": "secret",
            "label": "Secreto",
            "data_type": "string",
            "sensitive": True,
            "default_value": "hidden",
        }
    ]
    with pytest.raises(ValidationError, match="sensible"):
        UniversalQuery.model_validate(document)


def test_duplicate_source_alias_and_unknown_parameter_are_reported() -> None:
    document = minimal_document()
    body = document["query"]
    assert isinstance(body, dict)
    body["joins"] = [
        {
            "join_id": "join_1",
            "join_type": "cross",
            "source": {
                "source_id": "src_students",
                "entity_id": str(uuid.uuid4()),
                "alias": "students",
            },
        }
    ]
    body["where"] = {
        "node_type": "comparison",
        "operator": "equals",
        "left": {"node_type": "parameter", "parameter_id": "missing"},
        "right": {"node_type": "literal", "value_type": "integer", "value": 1},
    }
    _, issues = collect_references(UniversalQuery.model_validate(document))
    assert {item.code for item in issues} == {
        "QUERY_SOURCE_ALIAS_DUPLICATE",
        "QUERY_PARAMETER_NOT_FOUND",
    }
