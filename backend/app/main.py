import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.dependencies import close_redis_client
from app.api.errors import public_error_handler, validation_error_handler
from app.api.routers.access import router as access_router
from app.api.routers.auth import router as auth_router
from app.api.routers.compilations import router as compiler_router
from app.api.routers.compilations import saved_router as query_compilations_router
from app.api.routers.connections import router as connections_router
from app.api.routers.health import router as health_router
from app.api.routers.queries import model_router as query_model_router
from app.api.routers.queries import queries_router
from app.api.routers.relationships import router as relationships_router
from app.api.routers.roles import router as roles_router
from app.api.routers.schema import router as schema_router
from app.api.routers.semantic import router as semantic_router
from app.api.routers.users import router as users_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import async_session_factory, close_database_engine
from app.domain.connections.errors import PublicError
from app.infrastructure.repositories.auth import seed_rbac
from app.infrastructure.security.encryption import get_credential_encryption

settings = get_settings()
configure_logging(settings.APP_DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_credential_encryption()
    async with async_session_factory() as session:
        await seed_rbac(session)
    logger.info("application_started")
    yield
    await close_redis_client()
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
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(roles_router, prefix=settings.API_V1_PREFIX)
app.include_router(connections_router, prefix=settings.API_V1_PREFIX)
app.include_router(access_router, prefix=settings.API_V1_PREFIX)
app.include_router(schema_router, prefix=settings.API_V1_PREFIX)
app.include_router(relationships_router, prefix=settings.API_V1_PREFIX)
app.include_router(semantic_router, prefix=settings.API_V1_PREFIX)
app.include_router(query_model_router, prefix=settings.API_V1_PREFIX)
app.include_router(queries_router, prefix=settings.API_V1_PREFIX)
app.include_router(compiler_router, prefix=settings.API_V1_PREFIX)
app.include_router(query_compilations_router, prefix=settings.API_V1_PREFIX)
app.add_exception_handler(PublicError, public_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
