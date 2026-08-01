"""Add universal schema catalog.

Revision ID: 20260726_0004
Revises: 20260725_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0004"
down_revision: str | None = "20260725_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TIMESTAMP = sa.DateTime(timezone=True)


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column("first_seen_at", TIMESTAMP, nullable=False),
        sa.Column("last_seen_at", TIMESTAMP, nullable=False),
        sa.Column("created_at", TIMESTAMP, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", TIMESTAMP, server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "schema_synchronizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("started_at", TIMESTAMP, nullable=False),
        sa.Column("finished_at", TIMESTAMP),
        sa.Column("duration_ms", sa.Integer()),
        *[
            sa.Column(name, sa.Integer(), nullable=False, server_default="0")
            for name in (
                "entities_discovered",
                "fields_discovered",
                "relationships_discovered",
                "indexes_discovered",
                "entities_added",
                "entities_updated",
                "entities_removed",
                "fields_added",
                "fields_updated",
                "fields_removed",
            )
        ],
        sa.Column("warnings_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("error_code", sa.String(64)),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", TIMESTAMP, server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_schema_synchronizations_connection_id",
        "schema_synchronizations",
        ["connection_id"],
    )
    op.create_index("ix_schema_synchronizations_status", "schema_synchronizations", ["status"])
    op.create_table(
        "schema_entities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("physical_name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("engine", sa.String(32), nullable=False),
        sa.Column("schema_name", sa.String(255), nullable=False),
        sa.Column("comment", sa.Text()),
        sa.Column("estimated_rows", sa.Integer()),
        sa.Column("storage_engine", sa.String(64)),
        sa.Column("collation", sa.String(128), quote=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "connection_id", "schema_name", "physical_name", name="uq_schema_entity_key"
        ),
    )
    op.create_index("ix_schema_entities_connection_id", "schema_entities", ["connection_id"])
    op.create_index("ix_schema_entities_entity_type", "schema_entities", ["entity_type"])
    op.create_index("ix_schema_entities_is_active", "schema_entities", ["is_active"])
    op.create_table(
        "schema_fields",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("physical_name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("ordinal_position", sa.Integer(), nullable=False),
        sa.Column("native_data_type", sa.String(128), nullable=False),
        sa.Column("normalized_data_type", sa.String(32), nullable=False),
        sa.Column("column_type", sa.Text(), nullable=False),
        sa.Column("is_nullable", sa.Boolean(), nullable=False),
        sa.Column("default_value", sa.JSON()),
        sa.Column("is_primary_key", sa.Boolean(), nullable=False),
        sa.Column("is_unique", sa.Boolean(), nullable=False),
        sa.Column("is_auto_increment", sa.Boolean(), nullable=False),
        sa.Column("character_maximum_length", sa.Integer()),
        sa.Column("numeric_precision", sa.Integer()),
        sa.Column("numeric_scale", sa.Integer()),
        sa.Column("datetime_precision", sa.Integer()),
        sa.Column("character_set", sa.String(64)),
        sa.Column("collation", sa.String(128), quote=True),
        sa.Column("comment", sa.Text()),
        sa.Column("extra", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["entity_id"], ["schema_entities.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("entity_id", "physical_name", name="uq_schema_field_key"),
    )
    op.create_index("ix_schema_fields_entity_id", "schema_fields", ["entity_id"])
    op.create_index("ix_schema_fields_is_active", "schema_fields", ["is_active"])
    op.create_table(
        "schema_indexes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("physical_name", sa.String(255), nullable=False),
        sa.Column("index_type", sa.String(64)),
        sa.Column("is_unique", sa.Boolean(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["entity_id"], ["schema_entities.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("entity_id", "physical_name", name="uq_schema_index_key"),
    )
    op.create_index("ix_schema_indexes_entity_id", "schema_indexes", ["entity_id"])
    op.create_index("ix_schema_indexes_is_active", "schema_indexes", ["is_active"])
    op.create_table(
        "schema_index_fields",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("index_id", sa.Uuid(), nullable=False),
        sa.Column("field_id", sa.Uuid()),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("sort_direction", sa.String(8)),
        sa.Column("prefix_length", sa.Integer()),
        sa.ForeignKeyConstraint(["index_id"], ["schema_indexes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["field_id"], ["schema_fields.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("index_id", "sequence", name="uq_schema_index_field_sequence"),
    )
    op.create_index("ix_schema_index_fields_index_id", "schema_index_fields", ["index_id"])
    op.create_index("ix_schema_index_fields_field_id", "schema_index_fields", ["field_id"])
    op.create_table(
        "schema_physical_relationships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("constraint_name", sa.String(255), nullable=False),
        sa.Column("source_entity_id", sa.Uuid(), nullable=False),
        sa.Column("target_entity_id", sa.Uuid(), nullable=False),
        sa.Column("update_rule", sa.String(32)),
        sa.Column("delete_rule", sa.String(32)),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_entity_id"], ["schema_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_entity_id"], ["schema_entities.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "connection_id",
            "constraint_name",
            "source_entity_id",
            "target_entity_id",
            name="uq_schema_relationship_key",
        ),
    )
    for column in ("connection_id", "source_entity_id", "target_entity_id", "is_active"):
        op.create_index(
            f"ix_schema_physical_relationships_{column}",
            "schema_physical_relationships",
            [column],
        )
    op.create_table(
        "schema_relationship_fields",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("relationship_id", sa.Uuid(), nullable=False),
        sa.Column("source_field_id", sa.Uuid(), nullable=False),
        sa.Column("target_field_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["relationship_id"], ["schema_physical_relationships.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["source_field_id"], ["schema_fields.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_field_id"], ["schema_fields.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "relationship_id",
            "sequence",
            name="uq_schema_relationship_field_sequence",
        ),
    )
    op.create_index(
        "ix_schema_relationship_fields_relationship_id",
        "schema_relationship_fields",
        ["relationship_id"],
    )
    op.create_table(
        "schema_changes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("synchronization_id", sa.Uuid(), nullable=False),
        sa.Column("change_type", sa.String(32), nullable=False),
        sa.Column("object_type", sa.String(32), nullable=False),
        sa.Column("object_id", sa.Uuid(), nullable=False),
        sa.Column("physical_name", sa.String(512), nullable=False),
        sa.Column("previous_value_json", sa.JSON()),
        sa.Column("current_value_json", sa.JSON()),
        sa.Column("created_at", TIMESTAMP, server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["synchronization_id"], ["schema_synchronizations.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_schema_changes_synchronization_id", "schema_changes", ["synchronization_id"]
    )
    op.create_index("ix_schema_changes_type", "schema_changes", ["change_type", "object_type"])


def downgrade() -> None:
    for table in (
        "schema_changes",
        "schema_relationship_fields",
        "schema_physical_relationships",
        "schema_index_fields",
        "schema_indexes",
        "schema_fields",
        "schema_entities",
        "schema_synchronizations",
    ):
        op.drop_table(table)
