from types import SimpleNamespace
from unittest.mock import Mock

from sqlalchemy import BigInteger

from app.db.models.schema import SchemaField
from app.infrastructure.adapters.mysql import _has_datetime_precision_metadata


def test_detects_datetime_precision_metadata_when_available() -> None:
    connection = Mock()
    connection.execute.return_value = SimpleNamespace(scalar_one=lambda: 1)

    assert _has_datetime_precision_metadata(connection) is True
    statement = str(connection.execute.call_args.args[0])
    assert "COLUMN_NAME = 'DATETIME_PRECISION'" in statement


def test_detects_missing_datetime_precision_metadata() -> None:
    connection = Mock()
    connection.execute.return_value = SimpleNamespace(scalar_one=lambda: 0)

    assert _has_datetime_precision_metadata(connection) is False


def test_schema_field_supports_mysql_longtext_maximum_length() -> None:
    column_type = SchemaField.__table__.c.character_maximum_length.type

    assert isinstance(column_type, BigInteger)
