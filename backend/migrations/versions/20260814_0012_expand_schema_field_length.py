"""expand schema field character length

Revision ID: 20260814_0012
Revises: 20260807_0011
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260814_0012"
down_revision: str | None = "20260807_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "schema_fields",
        "character_maximum_length",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "schema_fields",
        "character_maximum_length",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using=(
            "CASE WHEN character_maximum_length <= 2147483647 "
            "THEN character_maximum_length::integer ELSE NULL END"
        ),
    )
