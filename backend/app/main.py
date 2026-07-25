import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import close_database_engine

settings = get_settings()
configure_logging(settings.APP_DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("application_started")
    yield
    await close_database_engine()
    logger.info("application_stopped")


app = FastAPI(
    title="DataNexus API",
    debug=settings.APP_DEBUG,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
