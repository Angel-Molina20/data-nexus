import csv
from datetime import date, datetime
from pathlib import Path

import pytest
from openpyxl import load_workbook
from pydantic import ValidationError

from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.csv import CsvReportExporter
from app.infrastructure.exporters.excel import ExcelReportExporter
from app.infrastructure.exporters.pdf import PdfReportExporter


def configuration(*, landscape: bool = False) -> ReportConfiguration:
    return ReportConfiguration.model_validate(
        {
            "header": {"title": "Estudiantes áé", "subtitle": "Activos"},
            "layout": {"orientation": "landscape" if landscape else "portrait"},
            "columns": [
                {"source_key": "name", "label": "Nombre", "position": 0},
                {
                    "source_key": "score",
                    "label": "Puntaje",
                    "position": 1,
                    "alignment": "right",
                    "format": {"type": "decimal"},
                },
                {"source_key": "secret", "label": "Oculto", "position": 2, "visible": False},
                {
                    "source_key": "created",
                    "label": "Fecha",
                    "position": 3,
                    "format": {"type": "date"},
                },
            ],
        }
    )


def rows() -> list[dict[str, object]]:
    return [
        {
            "name": '=HYPERLINK("https://invalid")',
            "score": 12.5,
            "secret": "no exportar",
            "created": date(2026, 8, 7),
        },
        {"name": "José,\nPérez", "score": None, "secret": "x", "created": None},
    ]


def test_csv_is_real_utf8_and_protects_formulas(tmp_path: Path) -> None:
    path = tmp_path / "report.csv"
    exporter = CsvReportExporter(
        delimiter=",", include_bom=True, null_value="", protect_formulas=True
    )

    assert exporter.export(path, configuration(), rows()) == 2
    with path.open(encoding="utf-8-sig", newline="") as stream:
        content = list(csv.reader(stream))

    assert content[0] == ["Nombre", "Puntaje", "Fecha"]
    assert content[1][0].startswith("'=")
    assert content[2] == ["José,\nPérez", "", ""]
    assert "no exportar" not in path.read_text(encoding="utf-8-sig")


def test_excel_preserves_native_values_and_visible_order(tmp_path: Path) -> None:
    path = tmp_path / "report.xlsx"
    assert ExcelReportExporter().export(path, configuration(), rows()) == 2

    workbook = load_workbook(path)
    sheet = workbook["Reporte"]
    assert [cell.value for cell in sheet[1]] == ["Nombre", "Puntaje", "Fecha"]
    assert sheet["A2"].value.startswith("'=")
    assert sheet["B2"].value == 12.5
    assert sheet["C2"].value == datetime(2026, 8, 7)
    assert sheet.freeze_panes == "A2"


def test_pdf_is_valid_and_honors_landscape(tmp_path: Path) -> None:
    path = tmp_path / "report.pdf"
    assert PdfReportExporter().export(path, configuration(landscape=True), rows()) == 2
    assert path.read_bytes().startswith(b"%PDF-")
    assert path.stat().st_size > 1000


def test_configuration_rejects_duplicate_or_hidden_columns() -> None:
    payload = configuration().model_dump()
    payload["columns"][1]["source_key"] = "name"
    with pytest.raises(ValidationError):
        ReportConfiguration.model_validate(payload)

    payload = configuration().model_dump()
    for column in payload["columns"]:
        column["visible"] = False
    with pytest.raises(ValidationError):
        ReportConfiguration.model_validate(payload)
