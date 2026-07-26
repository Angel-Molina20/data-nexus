import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import public_error_handler, validation_error_handler
from app.api.routers.connections import router as connections_router
from app.api.routers.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import close_database_engine
from app.domain.connections.errors import PublicError
from app.infrastructure.security.encryption import get_credential_encryption

settings = get_settings()
configure_logging(settings.APP_DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_credential_encryption()
    logger.info("application_started")
    yield
    await close_database_engine()
    logger.info("application_stopped")


app = FastAPI(
    title="DataNexus API",
    debug=settings.APP_DEBUG,
    lifespan=lifespan,
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(connections_router, prefix=settings.API_V1_PREFIX)
app.add_exception_handler(PublicError, public_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
