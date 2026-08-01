from typing import Final

from app.domain.connections.errors import PublicError


class MySQLDialect:
    name = "mysql"
    FUNCTIONS: Final[dict[str, str]] = {
        "lower": "LOWER",
        "upper": "UPPER",
        "trim": "TRIM",
        "length": "CHAR_LENGTH",
        "substring": "SUBSTRING",
        "concat": "CONCAT",
        "replace": "REPLACE",
        "coalesce": "COALESCE",
        "null_if": "NULLIF",
        "current_date": "CURRENT_DATE",
        "current_datetime": "CURRENT_TIMESTAMP",
        "year": "YEAR",
        "month": "MONTH",
        "day": "DAY",
        "date_difference": "DATEDIFF",
        "absolute": "ABS",
        "round": "ROUND",
        "floor": "FLOOR",
        "ceiling": "CEILING",
        "power": "POWER",
    }
    CASTS: Final[dict[str, str]] = {
        "string": "CHAR",
        "integer": "SIGNED",
        "decimal": "DECIMAL",
        "float": "DECIMAL",
        "boolean": "UNSIGNED",
        "date": "DATE",
        "datetime": "DATETIME",
    }
    INTERVAL_UNITS: Final[set[str]] = {
        "day",
        "week",
        "month",
        "quarter",
        "year",
        "hour",
        "minute",
        "second",
    }

    def quote_identifier(self, value: str) -> str:
        if not value or "\x00" in value:
            raise PublicError(
                "QUERY_IDENTIFIER_RESOLUTION_FAILED", "El identificador físico no es válido.", 422
            )
        return f"`{value.replace('`', '``')}`"

    def placeholder(self, binding: str) -> str:
        return f":{binding}"

    def function(self, name: str) -> str:
        try:
            return self.FUNCTIONS[name]
        except KeyError as error:
            raise PublicError(
                "QUERY_FUNCTION_COMPILATION_UNSUPPORTED",
                "La función no puede compilarse para MySQL.",
                422,
            ) from error

    def cast(self, target: str) -> str:
        try:
            return self.CASTS[target]
        except KeyError as error:
            raise PublicError(
                "QUERY_CAST_COMPILATION_UNSUPPORTED",
                "El CAST solicitado no está soportado para MySQL.",
                422,
            ) from error
