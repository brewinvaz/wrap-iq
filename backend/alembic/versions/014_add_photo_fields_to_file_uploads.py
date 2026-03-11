"""add photo_type and caption to file_uploads

Revision ID: 014
Revises: 013
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "014"
down_revision: str = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("file_uploads", sa.Column("photo_type", sa.String(20), nullable=True))
    op.add_column("file_uploads", sa.Column("caption", sa.String(500), nullable=True))
    op.create_index("ix_file_uploads_photo_type", "file_uploads", ["photo_type"])


def downgrade() -> None:
    op.drop_index("ix_file_uploads_photo_type", table_name="file_uploads")
    op.drop_column("file_uploads", "caption")
    op.drop_column("file_uploads", "photo_type")
