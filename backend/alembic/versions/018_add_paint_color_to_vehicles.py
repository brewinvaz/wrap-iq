"""add paint_color to vehicles

Revision ID: 018
Revises: 017
Create Date: 2026-03-13

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "018"
down_revision: str | Sequence[str] = "017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add paint_color to vehicles."""
    op.add_column(
        "vehicles", sa.Column("paint_color", sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    """Remove paint_color from vehicles."""
    op.drop_column("vehicles", "paint_color")
