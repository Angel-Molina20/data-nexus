"""mysql query compiler history

Revision ID: 20260802_0009
Revises: 20260802_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0009"
down_revision: str | None = "20260802_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "query_compilations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("saved_query_id", sa.Uuid(), nullable=True),
        sa.Column("query_revision", sa.Integer(), nullable=True),
        sa.Column("query_fingerprint", sa.String(64), nullable=False),
        sa.Column("compilation_fingerprint", sa.String(64), nullable=False),
        sa.Column("compiler_version", sa.String(24), nullable=False),
        sa.Column("engine", sa.String(32), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("server_version", sa.String(255), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("sql_template", sa.Text(), nullable=False),
        sa.Column("parameter_metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column("warnings_json", postgresql.JSONB(), nullable=False),
        sa.Column("errors_json", postgresql.JSONB(), nullable=False),
        sa.Column("capabilities_used_json", postgresql.JSONB(), nullable=False),
        sa.Column("complexity_json", postgresql.JSONB(), nullable=False),
        sa.Column("compiled_by", sa.Uuid(), nullable=False),
        sa.Column("compiled_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["compiled_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["saved_query_id"], ["saved_queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_query_compilations_query_compiled",
        "query_compilations",
        ["saved_query_id", "compiled_at"],
    )
    op.create_index(
        "ix_query_compilations_fingerprint", "query_compilations", ["compilation_fingerprint"]
    )
    op.create_index(
        "ix_query_compilations_saved_query_id", "query_compilations", ["saved_query_id"]
    )
    op.create_index("ix_query_compilations_compiled_by", "query_compilations", ["compiled_by"])


def downgrade() -> None:
    op.drop_table("query_compilations")
