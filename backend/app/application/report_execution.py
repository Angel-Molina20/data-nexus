import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from app.api.schemas.executions import (
    ExecutionColumnResponse,
    ExecutionOptionsRequest,
    ExecutionPaginationRequest,
    QueryExecutionRequest,
    QueryExecutionResultResponse,
)
from app.api.schemas.reports import ReportExportResponse, ReportPreviewResponse, ReportRunRequest
from app.application.auth import AuthorizationService, SessionPrincipal
from app.application.executions import QueryExecutionService
from app.application.reports import (
    ReportContext,
    export_response,
    report_response,
    safe_file_name,
)
from app.db.models.report import Report, ReportExport
from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import UniversalQuery
from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.common import format_value, visible_columns


class ReportExecutionService:
    """Preview and export a report through the safe query execution pipeline."""

    def __init__(self, context: ReportContext) -> None:
        self.context = context

    async def preview(
        self,
        model: Report,
        request: ReportRunRequest,
        principal: SessionPrincipal,
    ) -> ReportPreviewResponse:
        if model.status == "archived":
            raise PublicError("REPORT_ARCHIVED", "El reporte está archivado.", 409)
        await AuthorizationService(self.context.auth).require_connection_access(
            principal,
            model.connection_id,
            "analyst",
        )
        size = min(request.page_size or 25, self.context.settings.REPORT_PREVIEW_MAX_ROWS)
        result = await self._page(model, request.parameters, request.page, size, principal)
        configuration = ReportConfiguration.model_validate(model.configuration_json)
        columns, rows, warnings = self._present(configuration, result.columns, result.rows)
        return ReportPreviewResponse(
            report=report_response(model),
            execution=result.execution,
            columns=columns,
            rows=rows,
            warnings=[*result.warnings, *warnings],
        )

    async def export(
        self,
        model: Report,
        format: str,
        parameters: dict[str, Any],
        requested_name: str | None,
        principal: SessionPrincipal,
    ) -> ReportExportResponse:
        if model.status != "published":
            raise PublicError(
                "REPORT_NOT_PUBLISHED",
                "Publica el reporte antes de exportarlo.",
                409,
            )
        await AuthorizationService(self.context.auth).require_connection_access(
            principal,
            model.connection_id,
            "analyst",
        )
        if (
            await self.context.exports.active_count(principal.user.id)
            >= self.context.settings.REPORT_EXPORT_MAX_CONCURRENT_PER_USER
        ):
            raise PublicError(
                "REPORT_EXPORT_CONCURRENCY_LIMIT",
                "Alcanzaste el límite de exportaciones activas.",
                429,
            )

        exporter = self.context.exporters.get(
            format,
            self.context.settings.REPORT_EXPORT_ALLOWED_FORMATS,
        )
        record = ReportExport(
            report_id=model.id,
            query_id=model.query_id,
            query_revision=model.query_revision,
            requested_by=principal.user.id,
            format=format,
            status="processing",
            file_name=safe_file_name(requested_name or model.name, exporter.extension),
        )
        await self.context.exports.add(record)
        await self.context.session.commit()
        storage_key: str | None = None
        try:
            configuration = ReportConfiguration.model_validate(model.configuration_json)
            rows, columns = await self._collect_rows(model, parameters, principal, record)
            _, presented_rows, _ = self._present(configuration, columns, rows)
            storage_key, path = self.context.storage.allocate(exporter.extension)
            record.row_count = await asyncio.to_thread(
                exporter.export,
                path,
                configuration,
                presented_rows,
            )
            self.context.storage.secure_permissions(path)
            file_size = self.context.storage.size(storage_key)
            if file_size > self.context.settings.REPORT_EXPORT_MAX_FILE_SIZE_BYTES:
                raise PublicError(
                    "REPORT_EXPORT_FILE_TOO_LARGE",
                    "El archivo supera el tamaño permitido.",
                    400,
                )
            record.storage_key = storage_key
            record.content_type = exporter.content_type
            record.file_size = file_size
            record.status = "completed"
            record.finished_at = datetime.now(UTC)
            record.expires_at = record.finished_at + timedelta(
                days=self.context.settings.REPORT_EXPORT_RETENTION_DAYS
            )
            await self.context.session.commit()
            await self.context.session.refresh(record)
            return export_response(record)
        except TimeoutError as error:
            await self._fail(
                record,
                storage_key,
                "REPORT_EXPORT_TIMEOUT",
                "La exportación excedió el tiempo permitido.",
            )
            raise PublicError(
                "REPORT_EXPORT_TIMEOUT",
                "La exportación excedió el tiempo permitido.",
                504,
            ) from error
        except PublicError as error:
            await self._fail(record, storage_key, error.code, error.message)
            raise
        except Exception as error:
            await self._fail(
                record,
                storage_key,
                "REPORT_EXPORT_FAILED",
                "No fue posible generar el archivo.",
            )
            raise PublicError(
                "REPORT_EXPORT_FAILED",
                "No fue posible generar el archivo.",
                500,
            ) from error

    async def _collect_rows(
        self,
        model: Report,
        parameters: dict[str, Any],
        principal: SessionPrincipal,
        record: ReportExport,
    ) -> tuple[list[dict[str, Any]], list[ExecutionColumnResponse]]:
        rows: list[dict[str, Any]] = []
        columns: list[ExecutionColumnResponse] = []
        max_rows = min(
            self.context.settings.REPORT_EXPORT_MAX_ROWS,
            self.context.settings.QUERY_EXECUTION_MAX_ROWS,
        )
        page_size = min(
            self.context.settings.REPORT_EXPORT_BATCH_SIZE,
            self.context.settings.QUERY_EXECUTION_MAX_PAGE_SIZE,
        )
        page = 1
        async with asyncio.timeout(self.context.settings.REPORT_EXPORT_TIMEOUT_SECONDS):
            while len(rows) < max_rows:
                result = await self._page(model, parameters, page, page_size, principal)
                if not columns:
                    columns = result.columns
                rows.extend(result.rows[: max_rows - len(rows)])
                record.execution_id = result.execution.id
                if not result.execution.truncated or not result.rows:
                    break
                page += 1
        return rows, columns

    async def _page(
        self,
        model: Report,
        parameters: dict[str, Any],
        page: int,
        page_size: int,
        principal: SessionPrincipal,
    ) -> QueryExecutionResultResponse:
        payload = QueryExecutionRequest(
            connection_id=model.connection_id,
            ast=UniversalQuery.model_validate(model.query_document_json),
            parameters=parameters,
            pagination=ExecutionPaginationRequest(page=page, page_size=page_size),
            options=ExecutionOptionsRequest(
                include_total_count=False,
                include_compiled_sql=False,
            ),
        )
        return await QueryExecutionService(self.context.execution).execute(
            payload,
            principal.permissions,
            principal.user.id,
        )

    @staticmethod
    def _present(
        configuration: ReportConfiguration,
        source_columns: list[ExecutionColumnResponse],
        source_rows: list[dict[str, Any]],
    ) -> tuple[list[ExecutionColumnResponse], list[dict[str, Any]], list[str]]:
        available = {item.key: item for item in source_columns}
        configured = visible_columns(configuration)
        missing = [item.source_key for item in configured if item.source_key not in available]
        selected = [item for item in configured if item.source_key in available]
        if not selected:
            raise PublicError(
                "REPORT_QUERY_INCOMPATIBLE",
                "Las columnas configuradas no existen en el resultado.",
                409,
            )
        columns = [
            ExecutionColumnResponse(
                key=item.source_key,
                label=item.label,
                data_type=available[item.source_key].data_type,
                nullable=available[item.source_key].nullable,
                source=available[item.source_key].source,
                format=item.format.type,
            )
            for item in selected
        ]
        rows = [
            {item.source_key: format_value(row.get(item.source_key), item) for item in selected}
            for row in source_rows
        ]
        warnings = [f"Columnas no disponibles: {', '.join(missing)}"] if missing else []
        return columns, rows, warnings

    async def _fail(
        self,
        record: ReportExport,
        storage_key: str | None,
        code: str,
        message: str,
    ) -> None:
        if storage_key:
            self.context.storage.delete(storage_key)
        record.status = "failed"
        record.finished_at = datetime.now(UTC)
        record.error_code = code
        record.error_message = message
        await self.context.session.commit()
