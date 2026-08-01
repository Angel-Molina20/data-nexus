from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_authenticated_request
from app.api.schemas.health import HealthResponse, ReadinessDependencies, ReadinessResponse
from app.db.session import check_database_connection, get_db_session

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="datanexus-api")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    dependencies=[Depends(require_authenticated_request)],
)
async def readiness(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ReadinessResponse:
    try:
        await check_database_connection(session)
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready",
                "dependencies": {"postgres": "unavailable"},
            },
        ) from error

    return ReadinessResponse(
        status="ready",
        dependencies=ReadinessDependencies(postgres="ok"),
    )
