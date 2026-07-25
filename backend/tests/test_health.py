import pytest
from httpx import AsyncClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.routers import health as health_router


@pytest.mark.asyncio
async def test_health_response(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "datanexus-api",
    }


@pytest.mark.asyncio
async def test_readiness_with_available_postgres(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "dependencies": {"postgres": "ok"},
    }


@pytest.mark.asyncio
async def test_readiness_returns_controlled_error_when_postgres_is_unavailable(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unavailable_database_check(*_: object) -> None:
        raise SQLAlchemyError("database unavailable")

    monkeypatch.setattr(
        health_router,
        "check_database_connection",
        unavailable_database_check,
    )

    response = await async_client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "detail": {
            "status": "not_ready",
            "dependencies": {"postgres": "unavailable"},
        }
    }
