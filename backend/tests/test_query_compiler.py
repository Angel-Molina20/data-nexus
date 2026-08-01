import copy
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.db.models.database_connection import DatabaseConnection
from app.db.models.schema import SchemaEntity, SchemaField
from app.db.session import async_session_factory
from app.domain.connections.errors import PublicError
from app.domain.query_compiler.compiler import MySQLQueryCompiler
from app.domain.query_compiler.dialect import MySQLDialect
from app.domain.query_compiler.models import (
    CatalogEntity,
    CatalogField,
    CatalogRelationship,
    CatalogSnapshot,
    CompilationConnection,
    CompilationContext,
    CompilationOptions,
    PolymorphicMappingSnapshot,
    PolymorphicRelationshipSnapshot,
    RelationshipPair,
)
from app.domain.query_model.analysis import (
    calculate_complexity,
    normalized_document,
    query_fingerprint,
)
from app.domain.query_model.ast import UniversalQuery

CONNECTION_ID = uuid.uuid4()
STUDENTS_ID = uuid.uuid4()
CAREERS_ID = uuid.uuid4()
DOCUMENTS_ID = uuid.uuid4()
STUDENT_FIELD = uuid.uuid4()
STUDENT_NAME = uuid.uuid4()
STUDENT_CAREER = uuid.uuid4()
CAREER_FIELD = uuid.uuid4()
DOCUMENT_CLASS = uuid.uuid4()
DOCUMENT_CLASS_ID = uuid.uuid4()
PHYSICAL_RELATIONSHIP = uuid.uuid4()
POLYMORPHIC_RELATIONSHIP = uuid.uuid4()
POLYMORPHIC_MAPPING = uuid.uuid4()


def catalog() -> CatalogSnapshot:
    return CatalogSnapshot(
        entities={
            STUDENTS_ID: CatalogEntity(STUDENTS_ID, "academic", "students", True),
            CAREERS_ID: CatalogEntity(CAREERS_ID, "academic", "careers", True),
            DOCUMENTS_ID: CatalogEntity(DOCUMENTS_ID, "academic", "documents", True),
        },
        fields={
            STUDENT_FIELD: CatalogField(STUDENT_FIELD, STUDENTS_ID, "id", "integer", True),
            STUDENT_NAME: CatalogField(STUDENT_NAME, STUDENTS_ID, "name", "string", True),
            STUDENT_CAREER: CatalogField(STUDENT_CAREER, STUDENTS_ID, "career_id", "integer", True),
            CAREER_FIELD: CatalogField(CAREER_FIELD, CAREERS_ID, "id", "integer", True),
            DOCUMENT_CLASS: CatalogField(DOCUMENT_CLASS, DOCUMENTS_ID, "class", "string", True),
            DOCUMENT_CLASS_ID: CatalogField(
                DOCUMENT_CLASS_ID, DOCUMENTS_ID, "class_id", "integer", True
            ),
        },
        relationships={
            PHYSICAL_RELATIONSHIP: CatalogRelationship(
                PHYSICAL_RELATIONSHIP,
                "physical",
                STUDENTS_ID,
                CAREERS_ID,
                True,
                (RelationshipPair(STUDENT_CAREER, CAREER_FIELD, 1),),
            )
        },
        polymorphic_relationships={
            POLYMORPHIC_RELATIONSHIP: PolymorphicRelationshipSnapshot(
                POLYMORPHIC_RELATIONSHIP,
                DOCUMENTS_ID,
                DOCUMENT_CLASS,
                DOCUMENT_CLASS_ID,
                True,
            )
        },
        polymorphic_mappings={
            POLYMORPHIC_MAPPING: PolymorphicMappingSnapshot(
                POLYMORPHIC_MAPPING,
                POLYMORPHIC_RELATIONSHIP,
                "Student",
                STUDENTS_ID,
                STUDENT_FIELD,
                True,
            )
        },
    )


def compile_document(document: dict[str, object], *, major: int = 8):  # type: ignore[no-untyped-def]
    query = UniversalQuery.model_validate(document)
    context = CompilationContext(
        query=query,
        normalized_query=normalized_document(query),
        connection=CompilationConnection(
            CONNECTION_ID,
            "mysql",
            "mysql",
            f"{major}.0.42",
            major,
            0,
            {"supports_joins": True, "supports_subqueries": True, "supports_union": True},
        ),
        catalog=catalog(),
        current_user_id=uuid.uuid4(),
        options=CompilationOptions(),
        query_fingerprint=query_fingerprint(query),
        complexity=calculate_complexity(query),
    )
    return MySQLQueryCompiler().compile(context)


def base_query() -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "connection_id": str(CONNECTION_ID),
        "query": {
            "scope_id": "root",
            "source": {"source_id": "students", "entity_id": str(STUDENTS_ID), "alias": "s"},
            "select": [
                {
                    "select_id": "name",
                    "item_type": "field",
                    "expression": {
                        "node_type": "field",
                        "source_id": "students",
                        "field_id": str(STUDENT_NAME),
                    },
                    "alias": "student_name",
                }
            ],
        },
    }


def test_dialect_quotes_backticks() -> None:
    assert MySQLDialect().quote_identifier("strange`name") == "`strange``name`"


def test_compiles_fields_literals_order_and_limit_deterministically() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["where"] = {
        "node_type": "comparison",
        "operator": "equals",
        "left": {"node_type": "field", "source_id": "students", "field_id": str(STUDENT_NAME)},
        "right": {"node_type": "literal", "value_type": "string", "value": "Angel"},
    }
    body["order_by"] = [
        {
            "expression": {
                "node_type": "field",
                "source_id": "students",
                "field_id": str(STUDENT_NAME),
            },
            "direction": "ascending",
            "nulls": "last",
        }
    ]
    body["limit"] = 25
    first = compile_document(document, major=5)
    second = compile_document(document, major=5)
    assert "`academic`.`students` AS `s`" in first.sql
    assert "`s`.`name` = :p_1" in first.sql
    assert "LIMIT :p_2" in first.sql
    assert first.parameters == {"p_1": "Angel", "p_2": 25}
    assert first.sql == second.sql
    assert first.compilation_fingerprint == second.compilation_fingerprint
    assert first.executed is False


def test_compiles_physical_join() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["joins"] = [
        {
            "join_id": "career_join",
            "join_type": "inner",
            "source": {"source_id": "careers", "entity_id": str(CAREERS_ID), "alias": "c"},
            "relationship_id": str(PHYSICAL_RELATIONSHIP),
        }
    ]
    body["select"].append(
        {
            "select_id": "career_id",
            "item_type": "field",
            "expression": {
                "node_type": "field",
                "source_id": "careers",
                "field_id": str(CAREER_FIELD),
            },
        }
    )
    result = compile_document(document)
    assert "INNER JOIN `academic`.`careers` AS `c`" in result.sql
    assert "`s`.`career_id` = `c`.`id`" in result.sql
    assert "`c`.`id`" in result.sql
    assert result.capabilities_used == ("supports_joins",)


def test_compiles_physical_join_when_main_source_is_relationship_target() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["source"] = {
        "source_id": "careers",
        "entity_id": str(CAREERS_ID),
        "alias": "c",
    }
    body["select"] = [
        {
            "select_id": "student_name",
            "item_type": "field",
            "expression": {
                "node_type": "field",
                "source_id": "students",
                "field_id": str(STUDENT_NAME),
            },
        }
    ]
    body["joins"] = [
        {
            "join_id": "student_join",
            "join_type": "inner",
            "source": {"source_id": "students", "entity_id": str(STUDENTS_ID), "alias": "s"},
            "relationship_id": str(PHYSICAL_RELATIONSHIP),
        }
    ]

    result = compile_document(document)

    assert "FROM `academic`.`careers` AS `c`" in result.sql
    assert "INNER JOIN `academic`.`students` AS `s`" in result.sql
    assert "`s`.`career_id` = `c`.`id`" in result.sql
    assert "`s`.`name`" in result.sql


def test_polymorphic_join_always_binds_discriminator_and_identifier() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["source"] = {
        "source_id": "documents",
        "entity_id": str(DOCUMENTS_ID),
        "alias": "d",
    }
    body["select"] = [
        {
            "select_id": "document_class",
            "item_type": "field",
            "expression": {
                "node_type": "field",
                "source_id": "documents",
                "field_id": str(DOCUMENT_CLASS),
            },
        }
    ]
    body["joins"] = [
        {
            "join_id": "student_join",
            "join_type": "left",
            "source": {"source_id": "students", "entity_id": str(STUDENTS_ID), "alias": "s"},
            "relationship_id": str(POLYMORPHIC_RELATIONSHIP),
            "polymorphic_mapping_id": str(POLYMORPHIC_MAPPING),
        }
    ]
    result = compile_document(document)
    assert "`d`.`class_id` = `s`.`id`" in result.sql
    assert "`d`.`class` = :p_1" in result.sql
    assert result.parameters == {"p_1": "Student"}


def test_compiles_exists_with_correlation() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["where"] = {
        "node_type": "exists",
        "query": {
            "node_type": "subquery",
            "query_id": "career_exists",
            "query": {
                "scope_id": "career_scope",
                "source": {
                    "source_id": "careers",
                    "entity_id": str(CAREERS_ID),
                    "alias": "c",
                },
                "select": [
                    {
                        "select_id": "one",
                        "item_type": "literal",
                        "expression": {"node_type": "literal", "value_type": "integer", "value": 1},
                    }
                ],
                "where": {
                    "node_type": "comparison",
                    "operator": "equals",
                    "left": {
                        "node_type": "field",
                        "source_id": "careers",
                        "field_id": str(CAREER_FIELD),
                    },
                    "right": {
                        "node_type": "outer_field",
                        "scope_id": "root",
                        "source_id": "students",
                        "field_id": str(STUDENT_CAREER),
                    },
                },
            },
        },
    }
    result = compile_document(document)
    assert "EXISTS (SELECT" in result.sql
    assert "`c`.`id` = `s`.`career_id`" in result.sql
    assert "supports_subqueries" in result.capabilities_used


def test_rejects_missing_capability() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    body["joins"] = [
        {
            "join_id": "career_join",
            "join_type": "cross",
            "source": {"source_id": "careers", "entity_id": str(CAREERS_ID), "alias": "c"},
        }
    ]
    query = UniversalQuery.model_validate(document)
    context = CompilationContext(
        query,
        normalized_document(query),
        CompilationConnection(CONNECTION_ID, "mysql", "mysql", "5.6.51", 5, 6, {}),
        catalog(),
        uuid.uuid4(),
        CompilationOptions(),
        query_fingerprint(query),
        calculate_complexity(query),
    )
    with pytest.raises(PublicError) as error:
        MySQLQueryCompiler().compile(context)
    assert error.value.code == "QUERY_CAPABILITY_NOT_SUPPORTED"


def test_union_branches_isolate_aliases_and_parameters() -> None:
    document = base_query()
    body = document["query"]
    assert isinstance(body, dict)
    branch = copy.deepcopy(body)
    branch["select"] = [
        {
            "select_id": "literal_name",
            "item_type": "literal",
            "expression": {"node_type": "literal", "value_type": "string", "value": "branch"},
            "alias": "student_name",
        }
    ]
    body["unions"] = [{"union_id": "combined", "operation": "union_all", "query": branch}]
    result = compile_document(document)
    assert "UNION ALL" in result.sql
    assert result.parameters == {"p_1": "branch"}
    assert result.capabilities_used == ("supports_union",)


@pytest.mark.asyncio
async def test_compile_endpoint_uses_catalog_and_never_executes(async_client: AsyncClient) -> None:
    now = datetime.now(UTC)
    connection = DatabaseConnection(
        name=f"compiler-{uuid.uuid4()}",
        engine="mysql",
        provider="mysql",
        host="unused.example",
        port=3306,
        database_name="academic",
        username="unused",
        encrypted_password="not-used-by-compiler",
        capabilities_json={
            "supports_joins": True,
            "supports_subqueries": True,
            "supports_union": True,
        },
        raw_version="8.0.42",
        major_version=8,
        minor_version=0,
        patch_version=42,
        status="connected",
    )
    async with async_session_factory() as session:
        session.add(connection)
        await session.flush()
        entity = SchemaEntity(
            connection_id=connection.id,
            physical_name="students",
            display_name="students",
            entity_type="table",
            engine="mysql",
            schema_name="academic",
            is_active=True,
            first_seen_at=now,
            last_seen_at=now,
        )
        session.add(entity)
        await session.flush()
        field = SchemaField(
            entity_id=entity.id,
            physical_name="name",
            display_name="name",
            ordinal_position=1,
            native_data_type="varchar",
            normalized_data_type="string",
            column_type="varchar(120)",
            is_nullable=False,
            is_primary_key=False,
            is_unique=False,
            is_auto_increment=False,
            is_active=True,
            first_seen_at=now,
            last_seen_at=now,
        )
        session.add(field)
        await session.commit()
    response = await async_client.post(
        "/api/v1/query-compiler/compile",
        json={
            "document": {
                "schema_version": "1.0",
                "connection_id": str(connection.id),
                "query": {
                    "scope_id": "root",
                    "source": {
                        "source_id": "students",
                        "entity_id": str(entity.id),
                        "alias": "s",
                    },
                    "select": [
                        {
                            "select_id": "name",
                            "item_type": "field",
                            "expression": {
                                "node_type": "field",
                                "source_id": "students",
                                "field_id": str(field.id),
                            },
                        }
                    ],
                    "where": {
                        "node_type": "comparison",
                        "operator": "equals",
                        "left": {
                            "node_type": "field",
                            "source_id": "students",
                            "field_id": str(field.id),
                        },
                        "right": {
                            "node_type": "literal",
                            "value_type": "string",
                            "value": "must-remain-bound",
                        },
                    },
                },
            }
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["executed"] is False
    assert ":p_1" in payload["sql"]
    assert "must-remain-bound" not in payload["sql"]
    assert payload["parameters"]["p_1"]["data_type"] == "string"
    async with async_session_factory() as session:
        stored = await session.get(DatabaseConnection, connection.id)
        if stored:
            await session.delete(stored)
            await session.commit()
