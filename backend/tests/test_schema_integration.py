import pytest
from httpx import AsyncClient

from tests.test_mysql_integration import mysql_payload


@pytest.mark.integration
@pytest.mark.parametrize("prefix", ["MYSQL56", "MYSQL8"])
async def test_schema_catalog_lifecycle(
    async_client: AsyncClient, prefix: str
) -> None:
    created = await async_client.post(
        "/api/v1/connections", json=mysql_payload(prefix)
    )
    assert created.status_code == 201
    connection_id = created.json()["id"]

    first = await async_client.post(
        f"/api/v1/connections/{connection_id}/schema/synchronize"
    )
    assert first.status_code == 200
    result = first.json()
    assert result["status"] in {"completed", "completed_with_warnings"}
    assert result["entities_discovered"] >= 8
    assert result["fields_discovered"] >= 37
    assert result["indexes_discovered"] >= 16
    assert result["relationships_discovered"] >= 6
    assert "password" not in first.text.casefold()

    second = await async_client.post(
        f"/api/v1/connections/{connection_id}/schema/synchronize"
    )
    assert second.status_code == 200
    unchanged = second.json()
    assert unchanged["entities_added"] == 0
    assert unchanged["entities_updated"] == 0
    assert unchanged["entities_removed"] == 0
    assert unchanged["fields_added"] == 0
    assert unchanged["fields_updated"] == 0
    assert unchanged["fields_removed"] == 0

    summary = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/summary"
    )
    assert summary.status_code == 200
    assert summary.json()["tables"] >= 7
    assert summary.json()["views"] >= 1

    entities = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities",
        params={"search": "enrollments"},
    )
    assert entities.status_code == 200
    enrollment = entities.json()["items"][0]
    assert enrollment["has_primary_key"] is True
    assert enrollment["indexes_count"] >= 2

    detail = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities/{enrollment['id']}"
    )
    assert detail.status_code == 200
    assert any(index["fields"] for index in detail.json()["indexes"])
    assert detail.json()["outgoing_relationships"]

    history = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/synchronizations"
    )
    assert history.status_code == 200
    assert history.json()["total"] == 2

    deleted = await async_client.delete(f"/api/v1/connections/{connection_id}")
    assert deleted.status_code == 204
