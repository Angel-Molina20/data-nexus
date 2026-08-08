"""reports and exports

Revision ID: 20260807_0011
Revises: 20260803_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260807_0011"
down_revision: str | None = "20260803_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("query_id", sa.Uuid(), nullable=False),
        sa.Column("query_revision", sa.Integer(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subtitle", sa.String(255), nullable=True),
        sa.Column("configuration_json", postgresql.JSONB(), nullable=False),
        sa.Column("configuration_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("query_document_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["query_id"], ["saved_queries.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["connection_id"], ["database_connections.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("status IN ('draft','published','archived')", name="ck_reports_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_query_id", "reports", ["query_id"])
    op.create_index("ix_reports_connection_id", "reports", ["connection_id"])
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_created_by", "reports", ["created_by"])
    op.create_index(
        "ix_reports_creator_status_updated", "reports", ["created_by", "status", "updated_at"]
    )
    op.create_index("ix_reports_query_revision", "reports", ["query_id", "query_revision"])

    op.create_table(
        "report_exports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("query_id", sa.Uuid(), nullable=False),
        sa.Column("query_revision", sa.Integer(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=True),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("format", sa.String(8), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=True),
        sa.Column("content_type", sa.String(127), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["query_id"], ["saved_queries.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["execution_id"], ["query_executions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('pending','processing','completed','failed','cancelled','expired')",
            name="ck_report_exports_status",
        ),
        sa.CheckConstraint("format IN ('csv','xlsx','pdf')", name="ck_report_exports_format"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_report_exports_report_id", ["report_id"]),
        ("ix_report_exports_query_id", ["query_id"]),
        ("ix_report_exports_requested_by", ["requested_by"]),
        ("ix_report_exports_format", ["format"]),
        ("ix_report_exports_status", ["status"]),
        ("ix_report_exports_expires_at", ["expires_at"]),
        ("ix_report_exports_requester_created", ["requested_by", "created_at"]),
        ("ix_report_exports_report_created", ["report_id", "created_at"]),
        ("ix_report_exports_status_expires", ["status", "expires_at"]),
    ):
        op.create_index(name, "report_exports", columns)


def downgrade() -> None:
    op.drop_table("report_exports")
    op.drop_table("reports")
