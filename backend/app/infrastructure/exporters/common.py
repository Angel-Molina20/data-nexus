import json
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from app.domain.reports.configuration import ReportColumn, ReportConfiguration


def format_value(value: Any, column: ReportColumn) -> Any:
    if value is None:
        return column.format.null_label
    kind = column.format.type
    if kind in {"decimal", "currency", "percentage"}:
        decimal = Decimal(str(value))
        if kind == "percentage":
            decimal *= 100
        if column.format.decimal_places is not None:
            rendered = f"{decimal:.{column.format.decimal_places}f}"
        else:
            rendered = format(decimal, "f")
        if kind == "currency" and column.format.currency_code:
            return f"{column.format.currency_code} {rendered}"
        return f"{rendered}%" if kind == "percentage" else rendered
    if kind == "boolean" or isinstance(value, bool):
        return column.format.true_label if bool(value) else column.format.false_label
    if isinstance(value, datetime):
        if column.format.datetime_format:
            return value.strftime(column.format.datetime_format)
        return value.isoformat()
    if isinstance(value, date):
        if column.format.date_format:
            return value.strftime(column.format.date_format)
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if kind == "json" or isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    text = str(value)
    if column.format.truncate_length and len(text) > column.format.truncate_length:
        return text[: column.format.truncate_length] + "…"
    return value if isinstance(value, (int, float, Decimal)) else text


def visible_columns(configuration: ReportConfiguration) -> list[ReportColumn]:
    return sorted(
        (item for item in configuration.columns if item.visible), key=lambda item: item.position
    )


def protect_formula(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value
