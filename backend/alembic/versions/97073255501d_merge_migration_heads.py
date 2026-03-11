"""merge migration heads

Revision ID: 97073255501d
Revises: 012, a3f7c9d12e84
Create Date: 2026-03-10 23:39:46.385153

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97073255501d'
down_revision: Union[str, Sequence[str], None] = ('012', 'a3f7c9d12e84')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
