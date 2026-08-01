"""query execution history

Revision ID: 20260803_0010
Revises: 20260802_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260803_0010"
down_revision: str | None = "20260802_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "query_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("query_id", sa.Uuid(), nullable=True),
        sa.Column("query_revision", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("returned_row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("truncated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("page_size", sa.Integer(), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("database_engine", sa.String(32), nullable=False),
        sa.Column("database_version", sa.String(255), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["connection_id"], ["database_connections.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["query_id"], ["saved_queries.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_query_executions_user_started", ["user_id", "started_at"]),
        ("ix_query_executions_connection_started", ["connection_id", "started_at"]),
        ("ix_query_executions_query_started", ["query_id", "started_at"]),
        ("ix_query_executions_status_started", ["status", "started_at"]),
    ):
        op.create_index(name, "query_executions", columns)
    op.create_index("ix_query_executions_user_id", "query_executions", ["user_id"])
    op.create_index("ix_query_executions_connection_id", "query_executions", ["connection_id"])
    op.create_index("ix_query_executions_query_id", "query_executions", ["query_id"])
    op.create_index("ix_query_executions_status", "query_executions", ["status"])


def downgrade() -> None:
    op.drop_table("query_executions")
