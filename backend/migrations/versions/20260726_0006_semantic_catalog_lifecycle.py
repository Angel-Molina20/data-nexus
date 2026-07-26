"""cascade semantic catalog only when its parent connection is deleted

Revision ID: 20260726_0006
Revises: 20260726_0005
Create Date: 2026-07-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260726_0006"
down_revision: str | None = "20260726_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_foreign_key(
    table: str,
    constraint: str,
    columns: list[str],
    target: str,
    target_columns: list[str],
    *,
    cascade: bool,
) -> None:
    op.drop_constraint(constraint, table, type_="foreignkey")
    op.create_foreign_key(
        constraint,
        table,
        target,
        columns,
        target_columns,
        ondelete="CASCADE" if cascade else None,
    )


def _apply(*, cascade: bool) -> None:
    specifications = [
        (
            "semantic_relationships",
            "semantic_relationships_connection_id_fkey",
            ["connection_id"],
            "database_connections",
            ["id"],
        ),
        (
            "semantic_relationships",
            "semantic_relationships_source_entity_id_fkey",
            ["source_entity_id"],
            "schema_entities",
            ["id"],
        ),
        (
            "semantic_relationships",
            "semantic_relationships_target_entity_id_fkey",
            ["target_entity_id"],
            "schema_entities",
            ["id"],
        ),
        (
            "semantic_relationship_fields",
            "semantic_relationship_fields_source_field_id_fkey",
            ["source_field_id"],
            "schema_fields",
            ["id"],
        ),
        (
            "semantic_relationship_fields",
            "semantic_relationship_fields_target_field_id_fkey",
            ["target_field_id"],
            "schema_fields",
            ["id"],
        ),
        (
            "polymorphic_relationships",
            "polymorphic_relationships_connection_id_fkey",
            ["connection_id"],
            "database_connections",
            ["id"],
        ),
        (
            "polymorphic_relationships",
            "polymorphic_relationships_source_entity_id_fkey",
            ["source_entity_id"],
            "schema_entities",
            ["id"],
        ),
        (
            "polymorphic_relationships",
            "polymorphic_relationships_type_field_id_fkey",
            ["type_field_id"],
            "schema_fields",
            ["id"],
        ),
        (
            "polymorphic_relationships",
            "polymorphic_relationships_id_field_id_fkey",
            ["id_field_id"],
            "schema_fields",
            ["id"],
        ),
        (
            "polymorphic_relationship_mappings",
            "polymorphic_relationship_mappings_target_entity_id_fkey",
            ["target_entity_id"],
            "schema_entities",
            ["id"],
        ),
        (
            "polymorphic_relationship_mappings",
            "polymorphic_relationship_mappings_target_field_id_fkey",
            ["target_field_id"],
            "schema_fields",
            ["id"],
        ),
        (
            "semantic_entities",
            "semantic_entities_connection_id_fkey",
            ["connection_id"],
            "database_connections",
            ["id"],
        ),
        (
            "semantic_entities",
            "semantic_entities_schema_entity_id_fkey",
            ["schema_entity_id"],
            "schema_entities",
            ["id"],
        ),
        (
            "semantic_fields",
            "semantic_fields_schema_field_id_fkey",
            ["schema_field_id"],
            "schema_fields",
            ["id"],
        ),
    ]
    for table, constraint, columns, target, target_columns in specifications:
        _replace_foreign_key(
            table,
            constraint,
            columns,
            target,
            target_columns,
            cascade=cascade,
        )


def upgrade() -> None:
    _apply(cascade=True)


def downgrade() -> None:
    _apply(cascade=False)
