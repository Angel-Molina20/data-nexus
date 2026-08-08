import asyncio
import re
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.executions import (
    ExecutionColumnResponse,
    ExecutionOptionsRequest,
    ExecutionPaginationRequest,
    QueryExecutionRequest,
    QueryExecutionResultResponse,
)
from app.api.schemas.reports import (
    ReportCreateRequest,
    ReportExportResponse,
    ReportPreviewResponse,
    ReportResponse,
    ReportRunRequest,
    ReportUpdateRequest,
)
from app.application.auth import AuthorizationService, SessionPrincipal
from app.application.executions import ExecutionContext, QueryExecutionService
from app.application.queries import SavedQueryService, ValidateUniversalQueryService
from app.core.config import Settings
from app.db.models.query import SavedQuery
from app.db.models.report import Report, ReportExport
from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import UniversalQuery
from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.common import format_value, visible_columns
from app.infrastructure.exporters.registry import ReportExporterRegistry
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.auth import AuthRepository
from app.infrastructure.repositories.reports import ReportExportRepository, ReportRepository
from app.infrastructure.storage.local import LocalFileStorage


@dataclass
class ReportContext:
    session: AsyncSession
    reports: ReportRepository
    exports: ReportExportRepository
    execution: ExecutionContext
    audit: AuditRepository
    auth: AuthRepository
    exporters: ReportExporterRegistry
    storage: LocalFileStorage
    settings: Settings


def report_response(model: Report, *, current_revision: int | None = None) -> ReportResponse:
    compatible = current_revision is None or current_revision == model.query_revision
    warnings = (
        []
        if compatible
        else ["La consulta tiene una revisión posterior; el reporte conserva su instantánea."]
    )
    return ReportResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        query_id=model.query_id,
        query_revision=model.query_revision,
        connection_id=model.connection_id,
        status=model.status,
        title=model.title,
        subtitle=model.subtitle,
        configuration=ReportConfiguration.model_validate(model.configuration_json),
        configuration_version=model.configuration_version,
        created_by=model.created_by,
        published_at=model.published_at,
        archived_at=model.archived_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
        compatible=compatible,
        warnings=warnings,
    )


def export_response(model: ReportExport) -> ReportExportResponse:
    return ReportExportResponse(
        id=model.id,
        report_id=model.report_id,
        query_id=model.query_id,
        query_revision=model.query_revision,
        execution_id=model.execution_id,
        requested_by=model.requested_by,
        format=model.format,
        status=model.status,
        file_name=model.file_name,
        content_type=model.content_type,
        row_count=model.row_count,
        file_size=model.file_size,
        started_at=model.started_at,
        finished_at=model.finished_at,
        expires_at=model.expires_at,
        error_code=model.error_code,
        error_message=model.error_message,
        created_at=model.created_at,
        download_url=f"/api/v1/report-exports/{model.id}/download"
        if model.status == "completed"
        else None,
    )


class ReportService:
    def __init__(self, context: ReportContext) -> None:
        self.context = context

    async def create(
        self, request: ReportCreateRequest, principal: SessionPrincipal
    ) -> ReportResponse:
        query = await self._query(request.query_id, principal.user.id)
        await AuthorizationService(self.context.auth).require_connection_access(
            principal, query.connection_id, "analyst"
        )
        self._require_revision(query, request.query_revision)
        self._validate_columns(request.configuration, query.query_document_json)
        model = Report(
            name=request.name,
            description=request.description,
            query_id=query.id,
            query_revision=query.revision,
            connection_id=query.connection_id,
            status="draft",
            title=request.configuration.header.title,
            subtitle=request.configuration.header.subtitle,
            configuration_json=request.configuration.model_dump(mode="json"),
            configuration_version=1,
            query_document_json=query.query_document_json,
            created_by=principal.user.id,
        )
        await self.context.reports.add(model)
        await self.context.audit.record(
            action="report.create",
            result="success",
            duration_ms=0,
            connection_id=query.connection_id,
            resource_type="report",
            resource_id=str(model.id),
        )
        await self.context.session.commit()
        await self.context.session.refresh(model)
        return report_response(model, current_revision=query.revision)

    async def get(self, report_id: uuid.UUID, user_id: uuid.UUID) -> Report:
        model = await self.context.reports.get(report_id, user_id)
        if model is None:
            raise PublicError("REPORT_NOT_FOUND", "El reporte no existe.", 404)
        return model

    async def update(
        self, report_id: uuid.UUID, request: ReportUpdateRequest, principal: SessionPrincipal
    ) -> ReportResponse:
        model = await self.get(report_id, principal.user.id)
        if model.status == "archived":
            raise PublicError("REPORT_ARCHIVED", "Restaura el reporte antes de editarlo.", 409)
        if request.query_revision is not None and request.query_revision != model.query_revision:
            query = await self._query(model.query_id, principal.user.id)
            self._require_revision(query, request.query_revision)
            model.query_revision = query.revision
            model.query_document_json = query.query_document_json
        if request.name is not None:
            model.name = request.name
        if "description" in request.model_fields_set:
            model.description = request.description
        if request.configuration is not None:
            self._validate_columns(request.configuration, model.query_document_json)
            model.configuration_json = request.configuration.model_dump(mode="json")
            model.title = request.configuration.header.title
            model.subtitle = request.configuration.header.subtitle
        await self.context.session.commit()
        await self.context.session.refresh(model)
        current_query = await self.context.session.get(SavedQuery, model.query_id)
        return report_response(
            model, current_revision=current_query.revision if current_query else None
        )

    async def transition(
        self, report_id: uuid.UUID, principal: SessionPrincipal, status: str
    ) -> ReportResponse:
        model = await self.get(report_id, principal.user.id)
        if status == "published":
            await AuthorizationService(self.context.auth).require_connection_access(
                principal, model.connection_id, "analyst"
            )
            validation = await ValidateUniversalQueryService(
                self.context.execution.compiler.queries
            ).execute(
                UniversalQuery.model_validate(model.query_document_json), principal.permissions
            )
            if not validation.valid:
                raise PublicError(
                    "REPORT_QUERY_INCOMPATIBLE",
                    "La consulta del reporte ya no es válida para este usuario.",
                    409,
                )
            configuration = ReportConfiguration.model_validate(model.configuration_json)
            if not visible_columns(configuration):
                raise PublicError(
                    "REPORT_NO_VISIBLE_COLUMNS", "Selecciona al menos una columna visible.", 400
                )
            model.status, model.published_at, model.archived_at = (
                "published",
                datetime.now(UTC),
                None,
            )
        elif status == "archived":
            model.status, model.archived_at = "archived", datetime.now(UTC)
        elif status == "draft":
            model.status, model.archived_at = "draft", None
        await self.context.session.commit()
        await self.context.session.refresh(model)
        return report_response(model)

    async def delete(self, report_id: uuid.UUID, user_id: uuid.UUID) -> None:
        model = await self.get(report_id, user_id)
        exports, _ = await self.context.exports.list(
            user_id, page=1, page_size=1000, report_id=model.id
        )
        for item in exports:
            if item.storage_key:
                self.context.storage.delete(item.storage_key)
        await self.context.session.delete(model)
        await self.context.session.commit()

    async def _query(self, query_id: uuid.UUID, user_id: uuid.UUID) -> SavedQuery:
        return await SavedQueryService(self.context.execution.compiler.queries).require(
            query_id, user_id
        )

    @staticmethod
    def _require_revision(query: SavedQuery, revision: int) -> None:
        if query.revision != revision:
            raise PublicError(
                "REPORT_QUERY_REVISION_NOT_FOUND",
                "La revisión solicitada ya no está disponible.",
                409,
            )

    @staticmethod
    def _validate_columns(
        configuration: ReportConfiguration, query_document: dict[str, Any]
    ) -> None:
        query = UniversalQuery.model_validate(query_document)
        output_keys = {item.alias or item.label or item.select_id for item in query.query.select}
        unknown = [
            item.source_key for item in configuration.columns if item.source_key not in output_keys
        ]
        if unknown:
            raise PublicError(
                "REPORT_QUERY_INCOMPATIBLE",
                f"Columnas no disponibles en la revisión: {', '.join(unknown)}.",
                422,
            )


class ReportExecutionService:
    def __init__(self, context: ReportContext) -> None:
        self.context = context

    async def preview(
        self, model: Report, request: ReportRunRequest, principal: SessionPrincipal
    ) -> ReportPreviewResponse:
        if model.status == "archived":
            raise PublicError("REPORT_ARCHIVED", "El reporte está archivado.", 409)
        await AuthorizationService(self.context.auth).require_connection_access(
            principal, model.connection_id, "analyst"
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
                "REPORT_NOT_PUBLISHED", "Publica el reporte antes de exportarlo.", 409
            )
        await AuthorizationService(self.context.auth).require_connection_access(
            principal, model.connection_id, "analyst"
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
            format, self.context.settings.REPORT_EXPORT_ALLOWED_FORMATS
        )
        file_name = safe_file_name(requested_name or model.name, exporter.extension)
        record = ReportExport(
            report_id=model.id,
            query_id=model.query_id,
            query_revision=model.query_revision,
            requested_by=principal.user.id,
            format=format,
            status="processing",
            file_name=file_name,
        )
        await self.context.exports.add(record)
        await self.context.session.commit()
        key: str | None = None
        started = time.perf_counter()
        try:
            configuration = ReportConfiguration.model_validate(model.configuration_json)
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
            _, presented, _ = self._present(configuration, columns, rows)
            key, path = self.context.storage.allocate(exporter.extension)
            record.row_count = await asyncio.to_thread(
                exporter.export, path, configuration, presented
            )
            self.context.storage.secure_permissions(path)
            size = self.context.storage.size(key)
            if size > self.context.settings.REPORT_EXPORT_MAX_FILE_SIZE_BYTES:
                raise PublicError(
                    "REPORT_EXPORT_FILE_TOO_LARGE", "El archivo supera el tamaño permitido.", 400
                )
            record.storage_key, record.content_type, record.file_size = (
                key,
                exporter.content_type,
                size,
            )
            record.status, record.finished_at = "completed", datetime.now(UTC)
            record.expires_at = record.finished_at + timedelta(
                days=self.context.settings.REPORT_EXPORT_RETENTION_DAYS
            )
            await self.context.session.commit()
            await self.context.session.refresh(record)
            return export_response(record)
        except TimeoutError as error:
            await self._fail(
                record, key, "REPORT_EXPORT_TIMEOUT", "La exportación excedió el tiempo permitido."
            )
            raise PublicError(
                "REPORT_EXPORT_TIMEOUT", "La exportación excedió el tiempo permitido.", 504
            ) from error
        except PublicError as error:
            await self._fail(record, key, error.code, error.message)
            raise
        except Exception as error:
            await self._fail(
                record, key, "REPORT_EXPORT_FAILED", "No fue posible generar el archivo."
            )
            raise PublicError(
                "REPORT_EXPORT_FAILED", "No fue posible generar el archivo.", 500
            ) from error
        finally:
            _ = round((time.perf_counter() - started) * 1000)

    async def _page(
        self,
        model: Report,
        parameters: dict[str, Any],
        page: int,
        page_size: int,
        principal: SessionPrincipal,
    ) -> QueryExecutionResultResponse:
        ast = UniversalQuery.model_validate(model.query_document_json)
        payload = QueryExecutionRequest(
            connection_id=model.connection_id,
            ast=ast,
            parameters=parameters,
            pagination=ExecutionPaginationRequest(page=page, page_size=page_size),
            options=ExecutionOptionsRequest(include_total_count=False, include_compiled_sql=False),
        )
        return await QueryExecutionService(self.context.execution).execute(
            payload, principal.permissions, principal.user.id
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

    async def _fail(self, record: ReportExport, key: str | None, code: str, message: str) -> None:
        if key:
            self.context.storage.delete(key)
        record.status, record.finished_at = "failed", datetime.now(UTC)
        record.error_code, record.error_message = code, message
        await self.context.session.commit()


class ExpiredReportExportCleanupService:
    def __init__(self, context: ReportContext) -> None:
        self.context = context

    async def execute(self) -> tuple[int, int]:
        items = await self.context.exports.expired(datetime.now(UTC))
        deleted = 0
        for item in items:
            if item.storage_key and self.context.storage.delete(item.storage_key):
                deleted += 1
            item.status, item.storage_key = "expired", None
        await self.context.session.commit()
        return len(items), deleted


def safe_file_name(value: str, extension: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+", "-", value).strip("-._")[:120]
    return f"{base or 'reporte'}-{datetime.now(UTC):%Y-%m-%d}.{extension}"
