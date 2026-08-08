from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.common import format_value, visible_columns


class PdfReportExporter:
    format = "pdf"
    extension = "pdf"
    content_type = "application/pdf"

    def export(
        self, path: Path, configuration: ReportConfiguration, rows: Iterable[dict[str, Any]]
    ) -> int:
        page = A4 if configuration.layout.page_size == "A4" else letter
        if configuration.layout.orientation == "landscape":
            page = landscape(page)
        document = SimpleDocTemplate(str(path), pagesize=page, title=configuration.header.title)
        styles = getSampleStyleSheet()
        story: list[Any] = [Paragraph(escape(configuration.header.title), styles["Title"])]
        if configuration.header.subtitle:
            story.append(Paragraph(escape(configuration.header.subtitle), styles["Heading2"]))
        if configuration.header.description:
            story.append(Paragraph(escape(configuration.header.description), styles["BodyText"]))
        if configuration.layout.show_generated_at:
            generated_at = datetime.now(UTC).isoformat(timespec="seconds")
            story.append(Paragraph(f"Generado: {generated_at}", styles["BodyText"]))
        story.append(Spacer(1, 12))
        columns = visible_columns(configuration)
        data: list[list[Any]] = [
            [Paragraph(escape(item.label), styles["BodyText"]) for item in columns]
        ]
        count = 0
        for row in rows:
            data.append(
                [
                    Paragraph(
                        escape(str(format_value(row.get(item.source_key), item))),
                        styles["BodyText"],
                    )
                    for item in columns
                ]
            )
            count += 1
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#94a3b8")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
        if configuration.footer.show_row_count:
            story.extend([Spacer(1, 8), Paragraph(f"Registros: {count}", styles["BodyText"])])
        if configuration.footer.text:
            story.append(Paragraph(escape(configuration.footer.text), styles["BodyText"]))

        def draw_page_number(canvas: Any, current_document: Any) -> None:
            if not configuration.layout.show_page_numbers:
                return
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.drawRightString(page[0] - 36, 20, f"Página {current_document.page}")
            canvas.restoreState()

        document.build(story, onFirstPage=draw_page_number, onLaterPages=draw_page_number)
        return count
