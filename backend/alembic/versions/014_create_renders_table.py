"""create renders table

Revision ID: 014
Revises: 013
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: str = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "renders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            sa.Uuid(),
            sa.ForeignKey("work_orders.id"),
            nullable=True,
        ),
        sa.Column(
            "client_id", sa.Uuid(), sa.ForeignKey("clients.id"), nullable=True
        ),
        sa.Column(
            "vehicle_id", sa.Uuid(), sa.ForeignKey("vehicles.id"), nullable=True
        ),
        sa.Column("design_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "rendering", "completed", "failed", name="renderstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("vehicle_photo_key", sa.String(500), nullable=False),
        sa.Column("wrap_design_key", sa.String(500), nullable=False),
        sa.Column("result_image_key", sa.String(500), nullable=True),
        sa.Column("share_token", sa.String(64), nullable=True, unique=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_renders_organization_id", "renders", ["organization_id"])
    op.create_index("ix_renders_work_order_id", "renders", ["work_order_id"])
    op.create_index("ix_renders_client_id", "renders", ["client_id"])
    op.create_index("ix_renders_share_token", "renders", ["share_token"], unique=True)
    op.create_index("ix_renders_created_by", "renders", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_renders_created_by", table_name="renders")
    op.drop_index("ix_renders_share_token", table_name="renders")
    op.drop_index("ix_renders_client_id", table_name="renders")
    op.drop_index("ix_renders_work_order_id", table_name="renders")
    op.drop_index("ix_renders_organization_id", table_name="renders")
    op.drop_table("renders")
    op.execute("DROP TYPE IF EXISTS renderstatus")
