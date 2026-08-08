from datetime import date, datetime
from datetime import time as time_value
from decimal import Decimal, InvalidOperation
from typing import Any

from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import QueryParameterDefinition


def resolve_parameters(
    definitions: list[QueryParameterDefinition],
    supplied: dict[str, Any],
) -> dict[str, object]:
    """Validate and coerce supplied values against declared AST parameters."""
    declared = {item.parameter_id: item for item in definitions}
    unknown = set(supplied) - set(declared)
    if unknown:
        raise PublicError("QUERY_PARAMETER_UNKNOWN", "Se enviaron parámetros no declarados.", 400)

    result: dict[str, object] = {}
    for parameter_id, definition in declared.items():
        value = supplied.get(parameter_id, definition.default_value)
        if value is None:
            if definition.required and not definition.nullable:
                raise PublicError(
                    "QUERY_PARAMETER_MISSING",
                    f"Falta el parámetro {definition.label}.",
                    400,
                )
            result[parameter_id] = None
            continue
        try:
            result[parameter_id] = coerce_parameter(definition, value)
        except (ValueError, TypeError, InvalidOperation) as error:
            raise PublicError(
                "QUERY_PARAMETER_INVALID",
                f"El parámetro {definition.label} no es válido.",
                400,
            ) from error
    return result


def coerce_parameter(definition: QueryParameterDefinition, value: Any) -> object:
    data_type = definition.data_type
    if data_type in {"string", "enum", "uuid"}:
        converted: object = str(value)
    elif data_type == "integer":
        if isinstance(value, bool):
            raise ValueError
        converted = int(value)
    elif data_type in {"decimal", "float"}:
        converted = Decimal(str(value)) if data_type == "decimal" else float(value)
    elif data_type == "boolean":
        if not isinstance(value, bool):
            raise ValueError
        converted = value
    elif data_type == "date":
        converted = date.fromisoformat(str(value))
    elif data_type == "time":
        converted = time_value.fromisoformat(str(value))
    elif data_type == "datetime":
        converted = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    elif data_type == "list":
        if not isinstance(value, list):
            raise ValueError
        converted = value
    else:
        converted = value

    if definition.allowed_values is not None and converted not in definition.allowed_values:
        raise ValueError
    return converted
