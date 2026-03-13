"""add paint_color to vehicles, photo_type and caption to file_uploads

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
    """Add paint_color to vehicles, photo_type and caption to file_uploads."""
    op.add_column(
        "vehicles", sa.Column("paint_color", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "file_uploads", sa.Column("photo_type", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "file_uploads", sa.Column("caption", sa.String(length=500), nullable=True)
    )
    op.create_index(
        op.f("ix_file_uploads_photo_type"), "file_uploads", ["photo_type"], unique=False
    )


def downgrade() -> None:
    """Remove paint_color from vehicles, photo_type and caption from file_uploads."""
    op.drop_index(op.f("ix_file_uploads_photo_type"), table_name="file_uploads")
    op.drop_column("file_uploads", "caption")
    op.drop_column("file_uploads", "photo_type")
    op.drop_column("vehicles", "paint_color")
