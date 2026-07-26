"""semantic relationship catalog

Revision ID: 20260726_0005
Revises: 20260726_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0005"
down_revision: str | None = "20260726_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "semantic_entities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("schema_entity_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("singular_name", sa.String(160)),
        sa.Column("plural_name", sa.String(160)),
        sa.Column("description", sa.Text()),
        sa.Column("business_domain", sa.String(160)),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("updated_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"]),
        sa.ForeignKeyConstraint(["schema_entity_id"], ["schema_entities.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schema_entity_id", name="uq_semantic_entity_schema_entity"),
    )
    op.create_index("ix_semantic_entities_connection_id", "semantic_entities", ["connection_id"])
    op.create_index(
        "ix_semantic_entities_schema_entity_id", "semantic_entities", ["schema_entity_id"]
    )
    op.create_index(
        "ix_semantic_entities_business_domain", "semantic_entities", ["business_domain"]
    )

    op.create_table(
        "semantic_relationships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("relationship_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("detection_source", sa.String(40), nullable=False),
        sa.Column("source_entity_id", sa.Uuid(), nullable=False),
        sa.Column("target_entity_id", sa.Uuid()),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("cardinality", sa.String(32), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("is_bidirectional", sa.Boolean(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("conditions_json", sa.JSON(), nullable=False),
        sa.Column("reasons_json", sa.JSON(), nullable=False),
        sa.Column("warnings_json", sa.JSON(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("invalid_reason", sa.Text()),
        sa.Column(
            "detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("rejected_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("updated_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "confidence_score >= 0 AND confidence_score <= 1",
            name="ck_semantic_relationship_confidence",
        ),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"]),
        sa.ForeignKeyConstraint(["source_entity_id"], ["schema_entities.id"]),
        sa.ForeignKeyConstraint(["target_entity_id"], ["schema_entities.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "connection_id", "fingerprint", name="uq_semantic_relationship_fingerprint"
        ),
    )
    op.create_index(
        "ix_semantic_relationships_connection_id", "semantic_relationships", ["connection_id"]
    )
    op.create_index(
        "ix_semantic_relationships_source_entity_id", "semantic_relationships", ["source_entity_id"]
    )
    op.create_index(
        "ix_semantic_relationships_target_entity_id", "semantic_relationships", ["target_entity_id"]
    )
    op.create_index("ix_semantic_relationships_status", "semantic_relationships", ["status"])
    op.create_index(
        "ix_semantic_relationships_is_enabled", "semantic_relationships", ["is_enabled"]
    )
    op.create_index(
        "ix_semantic_relationship_type_status",
        "semantic_relationships",
        ["relationship_type", "status"],
    )

    op.create_table(
        "semantic_fields",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("schema_field_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("semantic_type", sa.String(40), nullable=False),
        sa.Column("format", sa.String(80)),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("updated_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["schema_field_id"], ["schema_fields.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schema_field_id", name="uq_semantic_field_schema_field"),
    )
    op.create_index("ix_semantic_fields_schema_field_id", "semantic_fields", ["schema_field_id"])
    op.create_index("ix_semantic_fields_is_sensitive", "semantic_fields", ["is_sensitive"])

    op.create_table(
        "semantic_relationship_fields",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("relationship_id", sa.Uuid(), nullable=False),
        sa.Column("source_field_id", sa.Uuid(), nullable=False),
        sa.Column("target_field_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("comparison_operator", sa.String(24), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["relationship_id"], ["semantic_relationships.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["source_field_id"], ["schema_fields.id"]),
        sa.ForeignKeyConstraint(["target_field_id"], ["schema_fields.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("relationship_id", "sequence", name="uq_semantic_rel_field_sequence"),
    )
    op.create_index(
        "ix_semantic_relationship_fields_relationship_id",
        "semantic_relationship_fields",
        ["relationship_id"],
    )
    op.create_index(
        "ix_semantic_relationship_fields_source_field_id",
        "semantic_relationship_fields",
        ["source_field_id"],
    )
    op.create_index(
        "ix_semantic_relationship_fields_target_field_id",
        "semantic_relationship_fields",
        ["target_field_id"],
    )

    op.create_table(
        "polymorphic_relationships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("source_entity_id", sa.Uuid(), nullable=False),
        sa.Column("type_field_id", sa.Uuid(), nullable=False),
        sa.Column("id_field_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("invalid_reason", sa.Text()),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("updated_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"]),
        sa.ForeignKeyConstraint(["source_entity_id"], ["schema_entities.id"]),
        sa.ForeignKeyConstraint(["type_field_id"], ["schema_fields.id"]),
        sa.ForeignKeyConstraint(["id_field_id"], ["schema_fields.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "connection_id",
            "source_entity_id",
            "type_field_id",
            "id_field_id",
            name="uq_polymorphic_relationship_fields",
        ),
    )
    for column in ("connection_id", "source_entity_id", "type_field_id", "id_field_id"):
        op.create_index(
            f"ix_polymorphic_relationships_{column}", "polymorphic_relationships", [column]
        )

    op.create_table(
        "polymorphic_relationship_mappings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("polymorphic_relationship_id", sa.Uuid(), nullable=False),
        sa.Column("type_value", sa.String(255), nullable=False),
        sa.Column("target_entity_id", sa.Uuid(), nullable=False),
        sa.Column("target_field_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["polymorphic_relationship_id"], ["polymorphic_relationships.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["target_entity_id"], ["schema_entities.id"]),
        sa.ForeignKeyConstraint(["target_field_id"], ["schema_fields.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "polymorphic_relationship_id",
            "type_value",
            name="uq_polymorphic_mapping_value",
        ),
    )
    op.create_index(
        "ix_poly_mapping_relationship",
        "polymorphic_relationship_mappings",
        ["polymorphic_relationship_id"],
    )
    op.create_index(
        "ix_polymorphic_relationship_mappings_target_entity_id",
        "polymorphic_relationship_mappings",
        ["target_entity_id"],
    )
    op.create_index(
        "ix_polymorphic_relationship_mappings_target_field_id",
        "polymorphic_relationship_mappings",
        ["target_field_id"],
    )


def downgrade() -> None:
    op.drop_table("polymorphic_relationship_mappings")
    op.drop_table("polymorphic_relationships")
    op.drop_table("semantic_relationship_fields")
    op.drop_table("semantic_fields")
    op.drop_table("semantic_relationships")
    op.drop_table("semantic_entities")
