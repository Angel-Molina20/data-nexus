from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class FunctionSignature:
    minimum_arguments: int
    maximum_arguments: int
    return_type: str
    capability: str | None = None


FUNCTIONS: Final[dict[str, FunctionSignature]] = {
    "lower": FunctionSignature(1, 1, "string"),
    "upper": FunctionSignature(1, 1, "string"),
    "trim": FunctionSignature(1, 1, "string"),
    "length": FunctionSignature(1, 1, "integer"),
    "substring": FunctionSignature(2, 3, "string"),
    "concat": FunctionSignature(2, 20, "string"),
    "replace": FunctionSignature(3, 3, "string"),
    "coalesce": FunctionSignature(2, 20, "unknown"),
    "null_if": FunctionSignature(2, 2, "unknown"),
    "current_date": FunctionSignature(0, 0, "date"),
    "current_datetime": FunctionSignature(0, 0, "datetime"),
    "year": FunctionSignature(1, 1, "integer"),
    "month": FunctionSignature(1, 1, "integer"),
    "day": FunctionSignature(1, 1, "integer"),
    "date_add": FunctionSignature(2, 2, "datetime"),
    "date_subtract": FunctionSignature(2, 2, "datetime"),
    "date_difference": FunctionSignature(2, 2, "integer"),
    "absolute": FunctionSignature(1, 1, "decimal"),
    "round": FunctionSignature(1, 2, "decimal"),
    "floor": FunctionSignature(1, 1, "integer"),
    "ceiling": FunctionSignature(1, 1, "integer"),
    "power": FunctionSignature(2, 2, "float"),
}
