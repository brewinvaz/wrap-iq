"""widen refresh_tokens.token column to 512 chars

Revision ID: 010
Revises: 009
Create Date: 2026-03-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, Sequence[str], None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "refresh_tokens",
        "token",
        existing_type=sa.String(255),
        type_=sa.String(512),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "refresh_tokens",
        "token",
        existing_type=sa.String(512),
        type_=sa.String(255),
        existing_nullable=False,
    )
