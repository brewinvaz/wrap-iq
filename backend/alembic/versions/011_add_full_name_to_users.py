"""add full_name column to users table

Revision ID: 011
Revises: 010
Create Date: 2026-03-10
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "011"
down_revision: str | Sequence[str] | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "full_name", sa.String(255), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "full_name")
