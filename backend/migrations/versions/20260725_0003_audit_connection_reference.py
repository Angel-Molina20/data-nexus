"""Keep deleted connection UUIDs in audit records.

Revision ID: 20260725_0003
Revises: 20260725_0002
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260725_0003"
down_revision: str | None = "20260725_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "audit_logs_connection_id_fkey",
        "audit_logs",
        type_="foreignkey",
    )


def downgrade() -> None:
    op.create_foreign_key(
        "audit_logs_connection_id_fkey",
        "audit_logs",
        "database_connections",
        ["connection_id"],
        ["id"],
        ondelete="SET NULL",
    )
