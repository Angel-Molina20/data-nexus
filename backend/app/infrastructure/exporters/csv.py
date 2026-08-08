import csv
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.common import format_value, protect_formula, visible_columns


class CsvReportExporter:
    format = "csv"
    extension = "csv"
    content_type = "text/csv; charset=utf-8"

    def __init__(
        self, *, delimiter: str, include_bom: bool, null_value: str, protect_formulas: bool
    ) -> None:
        self.delimiter = delimiter
        self.include_bom = include_bom
        self.null_value = null_value
        self.protect_formulas = protect_formulas

    def export(
        self, path: Path, configuration: ReportConfiguration, rows: Iterable[dict[str, Any]]
    ) -> int:
        columns = visible_columns(configuration)
        count = 0
        with path.open(
            "w", encoding="utf-8-sig" if self.include_bom else "utf-8", newline=""
        ) as stream:
            writer = csv.writer(stream, delimiter=self.delimiter, quoting=csv.QUOTE_MINIMAL)
            writer.writerow([column.label for column in columns])
            for row in rows:
                values = []
                for column in columns:
                    value = row.get(column.source_key)
                    rendered = self.null_value if value is None else format_value(value, column)
                    values.append(protect_formula(rendered) if self.protect_formulas else rendered)
                writer.writerow(values)
                count += 1
        return count
