import pytest

from app.domain.schema.types import normalize_native_type


@pytest.mark.parametrize(
    ("native_type", "expected"),
    [
        ("varchar", "string"),
        ("longtext", "text"),
        ("tinyint", "integer"),
        ("bigint", "integer"),
        ("numeric", "decimal"),
        ("double", "float"),
        ("timestamp", "datetime"),
        ("varbinary", "binary"),
        ("json", "json"),
        ("enum", "enum"),
        ("set", "set"),
        ("geometry", "unknown"),
    ],
)
def test_normalize_native_type(native_type: str, expected: str) -> None:
    assert normalize_native_type(native_type) == expected


def test_tinyint_one_is_not_assumed_to_be_boolean() -> None:
    assert normalize_native_type("tinyint", "tinyint(1)") == "integer"


def test_normalization_is_case_insensitive() -> None:
    assert normalize_native_type("VARCHAR") == "string"
