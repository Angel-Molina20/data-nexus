import os
import uuid

import pytest
from httpx import AsyncClient


def mysql_payload(prefix: str, *, password: str | None = None) -> dict[str, object]:
    return {
        "name": f"Integration {prefix} {uuid.uuid4()}",
        "engine": "mysql",
        "host": os.environ[f"{prefix}_HOST"],
        "port": int(os.environ[f"{prefix}_PORT"]),
        "database_name": os.environ[f"{prefix}_DATABASE"],
        "username": os.environ[f"{prefix}_USER"],
        "password": password or os.environ[f"{prefix}_PASSWORD"],
        "ssl_enabled": False,
        "configuration": {},
    }


@pytest.mark.integration
@pytest.mark.parametrize(("prefix", "major"), [("MYSQL56", 5), ("MYSQL8", 8)])
async def test_connection_lifecycle(
    async_client: AsyncClient, prefix: str, major: int
) -> None:
    payload = mysql_payload(prefix)
    tested = await async_client.post("/api/v1/connections/test", json=payload)
    assert tested.status_code == 200
    assert tested.json()["server"]["version"]["major"] == major
    assert "password" not in tested.text

    created = await async_client.post("/api/v1/connections", json=payload)
    assert created.status_code == 201
    connection_id = created.json()["id"]
    assert "password" not in created.text

    listed = await async_client.get(
        "/api/v1/connections", params={"search": str(payload["name"])}
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    detail = await async_client.get(f"/api/v1/connections/{connection_id}")
    assert detail.status_code == 200
    assert "password" not in detail.text

    renamed = await async_client.patch(
        f"/api/v1/connections/{connection_id}",
        json={"name": f"{payload['name']} renamed"},
    )
    assert renamed.status_code == 200

    retested = await async_client.post(f"/api/v1/connections/{connection_id}/test")
    assert retested.status_code == 200
    assert retested.json()["server"]["version"]["major"] == major

    deleted = await async_client.delete(f"/api/v1/connections/{connection_id}")
    assert deleted.status_code == 204


@pytest.mark.integration
async def test_wrong_password_returns_safe_error(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/api/v1/connections/test",
        json=mysql_payload("MYSQL8", password="definitely-wrong"),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "AUTHENTICATION_FAILED"
    assert "definitely-wrong" not in response.text
