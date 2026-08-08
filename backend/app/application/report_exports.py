import uuid
from datetime import UTC, datetime

from app.api.schemas.reports import ReportExportResponse
from app.application.auth import AuthorizationService, SessionPrincipal
from app.application.queries import ValidateUniversalQueryService
from app.application.reports import ReportContext, export_response
from app.db.models.report import ReportExport
from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import UniversalQuery


class ReportExportAccessService:
    """Authorize export metadata, downloads and deletion outside HTTP presentation."""

    def __init__(self, context: ReportContext) -> None:
        self.context = context

    async def list(
        self,
        user_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        report_id: uuid.UUID | None,
        format: str | None,
        status: str | None,
    ) -> tuple[list[ReportExportResponse], int]:
        items, total = await self.context.exports.list(
            user_id,
            page=page,
            page_size=page_size,
            report_id=report_id,
            format=format,
            status=status,
        )
        return [export_response(item) for item in items], total

    async def get_authorized(
        self,
        export_id: uuid.UUID,
        principal: SessionPrincipal,
        *,
        require_file: bool = False,
    ) -> ReportExport:
        model = await self.context.exports.get(export_id, principal.user.id)
        if model is None:
            raise PublicError("REPORT_EXPORT_NOT_FOUND", "La exportación no existe.", 404)
        report = await self.context.reports.get(model.report_id, principal.user.id)
        if report is None:
            raise self._download_denied()
        await AuthorizationService(self.context.auth).require_connection_access(
            principal,
            report.connection_id,
            "viewer",
        )
        validation = await ValidateUniversalQueryService(
            self.context.execution.compiler.queries
        ).execute(
            UniversalQuery.model_validate(report.query_document_json),
            principal.permissions,
        )
        if not validation.valid:
            raise self._download_denied()
        if require_file:
            self._require_available_file(model)
        return model

    async def delete(self, export_id: uuid.UUID, user_id: uuid.UUID) -> None:
        model = await self.context.exports.get(export_id, user_id)
        if model is None:
            return
        if model.storage_key:
            self.context.storage.delete(model.storage_key)
        await self.context.session.delete(model)
        await self.context.session.commit()

    def _require_available_file(self, model: ReportExport) -> None:
        if model.status == "expired" or (
            model.expires_at is not None and model.expires_at <= datetime.now(UTC)
        ):
            raise PublicError("REPORT_EXPORT_EXPIRED", "El archivo expiró.", 410)
        if not model.storage_key or not self.context.storage.exists(model.storage_key):
            raise PublicError(
                "REPORT_EXPORT_FILE_NOT_FOUND",
                "El archivo ya no está disponible.",
                404,
            )

    @staticmethod
    def _download_denied() -> PublicError:
        return PublicError(
            "REPORT_EXPORT_DOWNLOAD_DENIED",
            "No puedes descargar el archivo.",
            403,
        )
