from app.core.config import Settings
from app.domain.connections.errors import PublicError
from app.infrastructure.exporters.base import ReportExporter
from app.infrastructure.exporters.csv import CsvReportExporter
from app.infrastructure.exporters.excel import ExcelReportExporter
from app.infrastructure.exporters.pdf import PdfReportExporter


class ReportExporterRegistry:
    def __init__(self, settings: Settings) -> None:
        exporters: list[ReportExporter] = [
            CsvReportExporter(
                delimiter=settings.REPORT_CSV_DELIMITER,
                include_bom=settings.REPORT_CSV_INCLUDE_BOM,
                null_value=settings.REPORT_CSV_NULL_VALUE,
                protect_formulas=settings.REPORT_CSV_PROTECT_FORMULAS,
            ),
            ExcelReportExporter(),
            PdfReportExporter(),
        ]
        self._items = {item.format: item for item in exporters}

    def get(self, format: str, allowed: list[str]) -> ReportExporter:
        if format not in allowed or format not in self._items:
            raise PublicError(
                "REPORT_EXPORT_FORMAT_UNSUPPORTED", "El formato solicitado no está habilitado.", 400
            )
        return self._items[format]
