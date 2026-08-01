import pytest
from httpx import AsyncClient

from tests.test_mysql_integration import mysql_payload


@pytest.mark.integration
@pytest.mark.parametrize("prefix", ["MYSQL56", "MYSQL8"])
async def test_schema_catalog_lifecycle(async_client: AsyncClient, prefix: str) -> None:
    created = await async_client.post("/api/v1/connections", json=mysql_payload(prefix))
    assert created.status_code == 201
    connection_id = created.json()["id"]

    first = await async_client.post(f"/api/v1/connections/{connection_id}/schema/synchronize")
    assert first.status_code == 200
    result = first.json()
    assert result["status"] in {"completed", "completed_with_warnings"}
    assert result["entities_discovered"] >= 8
    assert result["fields_discovered"] >= 37
    assert result["indexes_discovered"] >= 16
    assert result["relationships_discovered"] >= 6
    assert "password" not in first.text.casefold()

    second = await async_client.post(f"/api/v1/connections/{connection_id}/schema/synchronize")
    assert second.status_code == 200
    unchanged = second.json()
    assert unchanged["entities_added"] == 0
    assert unchanged["entities_updated"] == 0
    assert unchanged["entities_removed"] == 0
    assert unchanged["fields_added"] == 0
    assert unchanged["fields_updated"] == 0
    assert unchanged["fields_removed"] == 0

    summary = await async_client.get(f"/api/v1/connections/{connection_id}/schema/summary")
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

    documents = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities",
        params={"search": "documents"},
    )
    careers = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities",
        params={"search": "careers"},
    )
    documents_detail = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities/{documents.json()['items'][0]['id']}"
    )
    careers_detail = await async_client.get(
        f"/api/v1/connections/{connection_id}/schema/entities/{careers.json()['items'][0]['id']}"
    )
    document_fields = {
        item["physical_name"]: item["id"] for item in documents_detail.json()["fields"]
    }
    career_fields = {item["physical_name"]: item["id"] for item in careers_detail.json()["fields"]}
    polymorphic_payload = {
        "source_entity_id": documents.json()["items"][0]["id"],
        "type_field_id": document_fields["class"],
        "id_field_id": document_fields["class_id"],
        "name": "documents_career",
        "display_name": "Documentos de carrera",
        "mappings": [
            {
                "type_value": "Career",
                "target_entity_id": careers.json()["items"][0]["id"],
                "target_field_id": career_fields["id"],
                "display_name": "Carrera",
            }
        ],
    }
    polymorphic = await async_client.post(
        f"/api/v1/connections/{connection_id}/relationships/polymorphic",
        json=polymorphic_payload,
    )
    assert polymorphic.status_code == 201
    duplicate = await async_client.post(
        f"/api/v1/connections/{connection_id}/relationships/polymorphic",
        json=polymorphic_payload,
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "POLYMORPHIC_RELATIONSHIP_ALREADY_EXISTS"

    history = await async_client.get(f"/api/v1/connections/{connection_id}/schema/synchronizations")
    assert history.status_code == 200
    assert history.json()["total"] == 2

    candidates = await async_client.get(
        f"/api/v1/connections/{connection_id}/relationships/candidates"
    )
    assert candidates.status_code == 200
    inferred = [item for item in candidates.json()["items"] if item["type"] == "inferred"]
    assert inferred
    confirmed = await async_client.post(
        f"/api/v1/connections/{connection_id}/relationships/candidates/{inferred[0]['id']}/confirm",
        json={},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"

    if len(inferred) > 1:
        rejected = await async_client.post(
            f"/api/v1/connections/{connection_id}/relationships/"
            f"candidates/{inferred[1]['id']}/reject"
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        redetected = await async_client.post(
            f"/api/v1/connections/{connection_id}/relationships/detect"
        )
        assert redetected.status_code == 200
        assert redetected.json()["preserved_rejections"] >= 1

    graph = await async_client.get(f"/api/v1/connections/{connection_id}/relationships/graph")
    assert graph.status_code == 200
    assert len(graph.json()["edges"]) >= result["relationships_discovered"]

    semantic = await async_client.get(f"/api/v1/connections/{connection_id}/semantic/entities")
    assert semantic.status_code == 200
    students_id = next(
        item["id"] for item in semantic.json()["items"] if item["physical_name"] == "students"
    )
    semantic_detail = await async_client.get(
        f"/api/v1/connections/{connection_id}/semantic/entities/{students_id}"
    )
    email_id = next(
        field["id"]
        for field in semantic_detail.json()["fields"]
        if field["physical_name"] == "email"
    )
    updated_field = await async_client.patch(
        f"/api/v1/connections/{connection_id}/semantic/fields/{email_id}",
        json={"semantic_type": "email", "is_sensitive": True},
    )
    assert updated_field.status_code == 200
    assert updated_field.json()["is_sensitive"] is True
    assert "password" not in graph.text.casefold()

    deleted = await async_client.delete(f"/api/v1/connections/{connection_id}")
    assert deleted.status_code == 204
