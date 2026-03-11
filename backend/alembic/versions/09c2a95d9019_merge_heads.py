"""merge heads

Revision ID: 09c2a95d9019
Revises: 004, 1ade3e86e611
Create Date: 2026-03-10 02:33:03.517018

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '09c2a95d9019'
down_revision: str | Sequence[str] | None = ('004', '1ade3e86e611')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
