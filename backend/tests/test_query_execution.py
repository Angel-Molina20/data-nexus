import copy
from datetime import date
from decimal import Decimal

import pytest

from app.application.executions import _paginate, _resolve_parameters
from app.domain.connections.errors import PublicError
from app.domain.query_execution.policies import ensure_compiled_read_only
from app.domain.query_model.ast import QueryParameterDefinition, UniversalQuery


def document() -> UniversalQuery:
    return UniversalQuery.model_validate(
        {
            "connection_id": "00000000-0000-0000-0000-000000000001",
            "query": {
                "source": {
                    "source_id": "source",
                    "entity_id": "00000000-0000-0000-0000-000000000002",
                    "alias": "source",
                },
                "select": [
                    {
                        "select_id": "value",
                        "item_type": "literal",
                        "expression": {
                            "node_type": "literal",
                            "value_type": "integer",
                            "value": 1,
                        },
                    }
                ],
            },
        }
    )


def parameter(data_type: str = "string", **values: object) -> QueryParameterDefinition:
    return QueryParameterDefinition.model_validate(
        {
            "parameter_id": "search",
            "name": "search",
            "label": "Búsqueda",
            "data_type": data_type,
            **values,
        }
    )


def test_read_only_policy_accepts_compiled_select_and_rejects_mutations() -> None:
    ensure_compiled_read_only("SELECT * FROM `students` WHERE `name` = :p_1")
    for sql in (
        "DELETE FROM students",
        "SELECT 1; DROP TABLE students",
        "SELECT 1 -- unsafe",
        "CALL modify_students()",
    ):
        with pytest.raises(PublicError) as caught:
            ensure_compiled_read_only(sql)
        assert caught.value.code == "QUERY_NOT_READ_ONLY"


def test_pagination_is_applied_to_ast_without_mutating_original() -> None:
    original = document()
    original.query.limit = 120
    paged = _paginate(original, page=2, page_size=50, max_rows=5000)
    assert original.query.offset is None
    assert original.query.limit == 120
    assert paged.query.offset == 50
    assert paged.query.limit == 51
    last = _paginate(original, page=3, page_size=50, max_rows=5000)
    assert last.query.offset == 100
    assert last.query.limit == 20


def test_parameters_are_required_typed_and_unknown_values_are_rejected() -> None:
    definitions = [parameter("decimal")]
    assert _resolve_parameters(definitions, {"search": "12.340"}) == {"search": Decimal("12.340")}
    with pytest.raises(PublicError) as missing:
        _resolve_parameters(definitions, {})
    assert missing.value.code == "QUERY_PARAMETER_MISSING"
    with pytest.raises(PublicError) as unknown:
        _resolve_parameters(definitions, {"search": "1", "extra": "unsafe"})
    assert unknown.value.code == "QUERY_PARAMETER_UNKNOWN"
    with pytest.raises(PublicError) as invalid:
        _resolve_parameters([parameter("date")], {"search": "not-a-date"})
    assert invalid.value.code == "QUERY_PARAMETER_INVALID"
    assert _resolve_parameters([parameter("date")], {"search": "2026-08-01"}) == {
        "search": date(2026, 8, 1)
    }


def test_parameter_defaults_are_copied_without_exposing_sensitive_defaults() -> None:
    optional = parameter(required=False, nullable=True, default_value="active")
    definitions = copy.deepcopy([optional])
    assert _resolve_parameters(definitions, {}) == {"search": "active"}
