import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from app.application.queries import QueryContext, SavedQueryService
from app.db.models.query import SavedQuery
from app.domain.query_model.ast import UniversalQuery


@pytest.mark.asyncio
async def test_update_refreshes_server_generated_fields_after_commit() -> None:
    document = UniversalQuery.model_validate(
        {
            "schema_version": "1.0",
            "connection_id": str(uuid.uuid4()),
            "query": {
                "scope_id": "root",
                "query_type": "select",
                "source": {
                    "source_id": "source_main",
                    "entity_id": str(uuid.uuid4()),
                    "alias": "students",
                },
                "select": [
                    {
                        "select_id": "student_id",
                        "item_type": "field",
                        "expression": {
                            "node_type": "field",
                            "source_id": "source_main",
                            "field_id": str(uuid.uuid4()),
                        },
                    }
                ],
            },
        }
    )
    now = datetime.now(UTC)
    model = SimpleNamespace(
        id=uuid.uuid4(),
        name="Consulta",
        description=None,
        connection_id=document.connection_id,
        owner_user_id=uuid.uuid4(),
        query_document_json={},
        schema_version="1.0",
        status="draft",
        validation_status="not_validated",
        validation_errors_json=[],
        validation_warnings_json=[],
        fingerprint=None,
        complexity_json=None,
        revision=1,
        last_validated_at=None,
        created_at=now,
        updated_at=now,
    )
    session = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
    service = SavedQueryService(cast(QueryContext, SimpleNamespace(session=session)))

    response = await service.update(cast(SavedQuery, model), 1, None, None, document)

    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(model)
    assert response.revision == 2
    assert response.document == document.model_dump(mode="json", exclude_none=True)
