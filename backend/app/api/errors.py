import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.connections.errors import PublicError

logger = logging.getLogger(__name__)


async def public_error_handler(_: Request, exception: Exception) -> JSONResponse:
    if not isinstance(exception, PublicError):
        raise TypeError("public_error_handler requires PublicError")
    error = exception
    logger.warning(
        "public_request_error",
        extra={"error_code": error.code},
    )
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "message": error.message, "details": error.details},
    )


async def validation_error_handler(_: Request, exception: Exception) -> JSONResponse:
    if not isinstance(exception, RequestValidationError):
        raise TypeError("validation_error_handler requires RequestValidationError")
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Los datos enviados no son válidos.",
            "details": None,
        },
    )
