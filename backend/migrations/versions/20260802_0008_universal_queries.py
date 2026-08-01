"""universal query drafts

Revision ID: 20260802_0008
Revises: 20260801_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0008"
down_revision: str | None = "20260801_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_queries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("query_document_json", postgresql.JSONB(), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="draft"),
        sa.Column(
            "validation_status", sa.String(24), nullable=False, server_default="not_validated"
        ),
        sa.Column(
            "validation_errors_json", postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column(
            "validation_warnings_json", postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column("fingerprint", sa.String(64), nullable=True),
        sa.Column("complexity_json", postgresql.JSONB(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["connection_id"], ["database_connections.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_user_id", "connection_id", "name", name="uq_saved_query_owner_name"
        ),
    )
    op.create_index("ix_saved_queries_owner_status", "saved_queries", ["owner_user_id", "status"])
    op.create_index(
        "ix_saved_queries_connection_updated", "saved_queries", ["connection_id", "updated_at"]
    )
    op.create_index("ix_saved_queries_connection_id", "saved_queries", ["connection_id"])
    op.create_index("ix_saved_queries_owner_user_id", "saved_queries", ["owner_user_id"])
    op.create_index("ix_saved_queries_status", "saved_queries", ["status"])
    op.create_index("ix_saved_queries_fingerprint", "saved_queries", ["fingerprint"])


def downgrade() -> None:
    op.drop_table("saved_queries")
