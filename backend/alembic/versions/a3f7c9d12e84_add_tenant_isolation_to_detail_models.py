"""add tenant isolation to detail models

Revision ID: a3f7c9d12e84
Revises: 41aa2436b506
Create Date: 2026-03-10 22:10:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f7c9d12e84"
down_revision: str = "41aa2436b506"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables that need the organization_id column added
_TABLES = [
    "design_details",
    "wrap_details",
    "production_details",
    "install_details",
    "work_order_vehicles",
    "webhook_deliveries",
    "estimate_line_items",
]


def upgrade() -> None:
    """Add organization_id with FK and index to detail/junction tables."""
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column("organization_id", sa.Uuid(), nullable=False),
        )
        op.create_foreign_key(
            f"fk_{table}_organization_id",
            table,
            "organizations",
            ["organization_id"],
            ["id"],
        )
        op.create_index(
            f"ix_{table}_organization_id",
            table,
            ["organization_id"],
        )


def downgrade() -> None:
    """Remove organization_id from detail/junction tables."""
    for table in reversed(_TABLES):
        op.drop_index(f"ix_{table}_organization_id", table_name=table)
        op.drop_constraint(f"fk_{table}_organization_id", table, type_="foreignkey")
        op.drop_column(table, "organization_id")
