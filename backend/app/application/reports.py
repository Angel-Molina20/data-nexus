import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.reports import (
    ReportCreateRequest,
    ReportExportResponse,
    ReportListResponse,
    ReportResponse,
    ReportUpdateRequest,
)
from app.application.auth import AuthorizationService, SessionPrincipal
from app.application.executions import ExecutionContext
from app.application.queries import SavedQueryService, ValidateUniversalQueryService
from app.core.config import Settings
from app.db.models.query import SavedQuery
from app.db.models.report import Report, ReportExport
from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import UniversalQuery
from app.domain.reports.configuration import ReportConfiguration
from app.infrastructure.exporters.common import visible_columns
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

    async def get_response(self, report_id: uuid.UUID, user_id: uuid.UUID) -> ReportResponse:
        model = await self.get(report_id, user_id)
        current_query = await self.context.session.get(SavedQuery, model.query_id)
        return report_response(
            model,
            current_revision=current_query.revision if current_query else None,
        )

    async def list(
        self,
        user_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        status: str | None,
        query_id: uuid.UUID | None,
        connection_id: uuid.UUID | None,
        search: str | None,
        include_archived: bool,
    ) -> ReportListResponse:
        items, total = await self.context.reports.list(
            user_id,
            page=page,
            page_size=page_size,
            status=status,
            query_id=query_id,
            connection_id=connection_id,
            search=search,
            include_archived=include_archived,
        )
        query_ids = {item.query_id for item in items}
        revisions = {
            query_id: query.revision
            for query_id in query_ids
            if (query := await self.context.session.get(SavedQuery, query_id)) is not None
        }
        return ReportListResponse(
            items=[
                report_response(item, current_revision=revisions.get(item.query_id))
                for item in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

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
