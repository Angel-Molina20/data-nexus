import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.api.dependencies import (
    CurrentPrincipal,
    ReportContextDependency,
    require_csrf,
    require_permission,
)
from app.api.schemas.reports import (
    CleanupResponse,
    ReportCreateRequest,
    ReportExportListResponse,
    ReportExportRequest,
    ReportExportResponse,
    ReportListResponse,
    ReportPreviewResponse,
    ReportResponse,
    ReportRunRequest,
    ReportUpdateRequest,
)
from app.application.auth import AuthorizationService
from app.application.queries import ValidateUniversalQueryService
from app.application.reports import (
    ExpiredReportExportCleanupService,
    ReportExecutionService,
    ReportService,
    export_response,
    report_response,
)
from app.db.models.query import SavedQuery
from app.domain.connections.errors import PublicError
from app.domain.query_model.ast import UniversalQuery

router = APIRouter(prefix="/reports", tags=["reports"])
exports_router = APIRouter(prefix="/report-exports", tags=["report-exports"])


@router.post(
    "",
    response_model=ReportResponse,
    status_code=201,
    dependencies=[Depends(require_permission("reports.create")), Depends(require_csrf)],
)
async def create_report(
    request: ReportCreateRequest, context: ReportContextDependency, principal: CurrentPrincipal
) -> ReportResponse:
    return await ReportService(context).create(request, principal)


@router.get(
    "",
    response_model=ReportListResponse,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def list_reports(
    context: ReportContextDependency,
    principal: CurrentPrincipal,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    query_id: uuid.UUID | None = None,
    connection_id: uuid.UUID | None = None,
    search: str | None = None,
    include_archived: bool = False,
) -> ReportListResponse:
    items, total = await context.reports.list(
        principal.user.id,
        page=page,
        page_size=page_size,
        status=status,
        query_id=query_id,
        connection_id=connection_id,
        search=search,
        include_archived=include_archived,
    )
    responses = []
    for item in items:
        current_query = await context.session.get(SavedQuery, item.query_id)
        responses.append(
            report_response(
                item, current_revision=current_query.revision if current_query else None
            )
        )
    return ReportListResponse(items=responses, total=total, page=page, page_size=page_size)


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_report(
    report_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> ReportResponse:
    model = await ReportService(context).get(report_id, principal.user.id)
    current_query = await context.session.get(SavedQuery, model.query_id)
    return report_response(
        model, current_revision=current_query.revision if current_query else None
    )


@router.patch(
    "/{report_id}",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports.update")), Depends(require_csrf)],
)
async def update_report(
    report_id: uuid.UUID,
    request: ReportUpdateRequest,
    context: ReportContextDependency,
    principal: CurrentPrincipal,
) -> ReportResponse:
    return await ReportService(context).update(report_id, request, principal)


@router.delete(
    "/{report_id}",
    status_code=204,
    dependencies=[Depends(require_permission("reports.delete")), Depends(require_csrf)],
)
async def delete_report(
    report_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> Response:
    await ReportService(context).delete(report_id, principal.user.id)
    return Response(status_code=204)


@router.post(
    "/{report_id}/publish",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports.publish")), Depends(require_csrf)],
)
async def publish_report(
    report_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> ReportResponse:
    return await ReportService(context).transition(report_id, principal, "published")


@router.post(
    "/{report_id}/archive",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports.archive")), Depends(require_csrf)],
)
async def archive_report(
    report_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> ReportResponse:
    return await ReportService(context).transition(report_id, principal, "archived")


@router.post(
    "/{report_id}/preview",
    response_model=ReportPreviewResponse,
    dependencies=[Depends(require_permission("reports.execute")), Depends(require_csrf)],
)
async def preview_report(
    report_id: uuid.UUID,
    request: ReportRunRequest,
    context: ReportContextDependency,
    principal: CurrentPrincipal,
) -> ReportPreviewResponse:
    model = await ReportService(context).get(report_id, principal.user.id)
    return await ReportExecutionService(context).preview(model, request, principal)


@router.post(
    "/{report_id}/execute",
    response_model=ReportPreviewResponse,
    dependencies=[Depends(require_permission("reports.execute")), Depends(require_csrf)],
)
async def execute_report(
    report_id: uuid.UUID,
    request: ReportRunRequest,
    context: ReportContextDependency,
    principal: CurrentPrincipal,
) -> ReportPreviewResponse:
    model = await ReportService(context).get(report_id, principal.user.id)
    if model.status != "published":
        raise PublicError("REPORT_NOT_PUBLISHED", "Publica el reporte antes de ejecutarlo.", 409)
    return await ReportExecutionService(context).preview(model, request, principal)


@router.post(
    "/{report_id}/exports",
    response_model=ReportExportResponse,
    status_code=201,
    dependencies=[Depends(require_permission("reports.export")), Depends(require_csrf)],
)
async def create_export(
    report_id: uuid.UUID,
    request: ReportExportRequest,
    context: ReportContextDependency,
    principal: CurrentPrincipal,
) -> ReportExportResponse:
    model = await ReportService(context).get(report_id, principal.user.id)
    return await ReportExecutionService(context).export(
        model, request.format, request.parameters, request.options.file_name, principal
    )


@exports_router.get(
    "",
    response_model=ReportExportListResponse,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def list_exports(
    context: ReportContextDependency,
    principal: CurrentPrincipal,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_id: uuid.UUID | None = None,
    format: str | None = None,
    status: str | None = None,
) -> ReportExportListResponse:
    items, total = await context.exports.list(
        principal.user.id,
        page=page,
        page_size=page_size,
        report_id=report_id,
        format=format,
        status=status,
    )
    return ReportExportListResponse(
        items=[export_response(item) for item in items], total=total, page=page, page_size=page_size
    )


@exports_router.get(
    "/{export_id}",
    response_model=ReportExportResponse,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_export(
    export_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> ReportExportResponse:
    model = await context.exports.get(export_id, principal.user.id)
    if model is None:
        raise PublicError("REPORT_EXPORT_NOT_FOUND", "La exportación no existe.", 404)
    report = await context.reports.get(model.report_id, principal.user.id)
    if report is None:
        raise PublicError("REPORT_EXPORT_DOWNLOAD_DENIED", "No puedes descargar el archivo.", 403)
    await AuthorizationService(context.auth).require_connection_access(
        principal, report.connection_id, "viewer"
    )
    validation = await ValidateUniversalQueryService(context.execution.compiler.queries).execute(
        UniversalQuery.model_validate(report.query_document_json), principal.permissions
    )
    if not validation.valid:
        raise PublicError("REPORT_EXPORT_DOWNLOAD_DENIED", "No puedes descargar el archivo.", 403)
    return export_response(model)


@exports_router.get(
    "/{export_id}/download", dependencies=[Depends(require_permission("reports.download"))]
)
async def download_export(
    export_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> StreamingResponse:
    model = await context.exports.get(export_id, principal.user.id)
    if model is None:
        raise PublicError("REPORT_EXPORT_NOT_FOUND", "La exportación no existe.", 404)
    report = await context.reports.get(model.report_id, principal.user.id)
    if report is None:
        raise PublicError("REPORT_EXPORT_DOWNLOAD_DENIED", "No puedes descargar el archivo.", 403)
    await AuthorizationService(context.auth).require_connection_access(
        principal, report.connection_id, "viewer"
    )
    validation = await ValidateUniversalQueryService(context.execution.compiler.queries).execute(
        UniversalQuery.model_validate(report.query_document_json), principal.permissions
    )
    if not validation.valid:
        raise PublicError("REPORT_EXPORT_DOWNLOAD_DENIED", "No puedes descargar el archivo.", 403)
    if (
        model.status == "expired"
        or model.expires_at is not None
        and model.expires_at <= datetime.now(UTC)
    ):
        raise PublicError("REPORT_EXPORT_EXPIRED", "El archivo expiró.", 410)
    if not model.storage_key or not context.storage.exists(model.storage_key):
        raise PublicError("REPORT_EXPORT_FILE_NOT_FOUND", "El archivo ya no está disponible.", 404)
    stream = context.storage.open(model.storage_key)

    async def body() -> AsyncIterator[bytes]:
        try:
            while chunk := stream.read(65536):
                yield chunk
        finally:
            stream.close()

    return StreamingResponse(
        body(),
        media_type=model.content_type,
        headers={"Content-Disposition": f'attachment; filename="{model.file_name}"'},
    )


@exports_router.delete(
    "/{export_id}",
    status_code=204,
    dependencies=[Depends(require_permission("reports.delete")), Depends(require_csrf)],
)
async def delete_export(
    export_id: uuid.UUID, context: ReportContextDependency, principal: CurrentPrincipal
) -> Response:
    model = await context.exports.get(export_id, principal.user.id)
    if model is not None:
        if model.storage_key:
            context.storage.delete(model.storage_key)
        await context.session.delete(model)
        await context.session.commit()
    return Response(status_code=204)


@exports_router.post(
    "/cleanup/expired",
    response_model=CleanupResponse,
    dependencies=[Depends(require_permission("reports.delete")), Depends(require_csrf)],
)
async def cleanup_exports(context: ReportContextDependency) -> CleanupResponse:
    expired, deleted = await ExpiredReportExportCleanupService(context).execute()
    return CleanupResponse(expired=expired, files_deleted=deleted)
