from typing import Literal

Compatibility = Literal[
    "compatible", "compatible_with_coercion", "compatible_with_warning", "incompatible"
]
NUMERIC = {"integer", "decimal", "float"}
TEXTUAL = {"string", "text", "enum", "set", "uuid"}
TEMPORAL = {"date", "time", "datetime"}


def compatibility(left: str, right: str) -> Compatibility:
    if left == right or "unknown" in {left, right} or "null" in {left, right}:
        return "compatible"
    if left in NUMERIC and right in NUMERIC:
        return "compatible_with_coercion"
    if left in TEXTUAL and right in TEXTUAL:
        return "compatible_with_warning"
    if left in TEMPORAL and right in TEMPORAL:
        return "compatible_with_warning"
    return "incompatible"
