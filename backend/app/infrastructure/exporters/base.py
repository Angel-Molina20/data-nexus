from collections.abc import Iterable
from pathlib import Path
from typing import Any, Protocol

from app.domain.reports.configuration import ReportConfiguration


class ReportExporter(Protocol):
    format: str
    extension: str
    content_type: str

    def export(
        self,
        path: Path,
        configuration: ReportConfiguration,
        rows: Iterable[dict[str, Any]],
    ) -> int: ...
