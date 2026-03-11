"""add checklist JSONB column to work_orders table

Revision ID: 012
Revises: 011
Create Date: 2026-03-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "012"
down_revision: str | Sequence[str] | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column("checklist", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "checklist")
