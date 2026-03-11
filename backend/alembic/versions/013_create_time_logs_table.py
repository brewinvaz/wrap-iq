"""create time_logs table

Revision ID: 013
Revises: 06a40acd1a7c
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "013"
down_revision: str = "06a40acd1a7c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "time_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), sa.ForeignKey("work_orders.id"), nullable=True),
        sa.Column("task", sa.String(255), nullable=False),
        sa.Column("hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("submitted", "approved", name="timelogstatus"),
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_time_logs_organization_id", "time_logs", ["organization_id"])
    op.create_index("ix_time_logs_user_id", "time_logs", ["user_id"])
    op.create_index("ix_time_logs_work_order_id", "time_logs", ["work_order_id"])


def downgrade() -> None:
    op.drop_index("ix_time_logs_work_order_id", table_name="time_logs")
    op.drop_index("ix_time_logs_user_id", table_name="time_logs")
    op.drop_index("ix_time_logs_organization_id", table_name="time_logs")
    op.drop_table("time_logs")
    op.execute("DROP TYPE IF EXISTS timelogstatus")
