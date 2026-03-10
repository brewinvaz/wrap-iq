"""add missing FK indexes on plan_id, work_order_id, template_id, recipient_user_id

Revision ID: 009
Revises: 008
Create Date: 2026-03-10
"""

from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])
    op.create_index("ix_organizations_plan_id", "organizations", ["plan_id"])
    op.create_index("ix_estimates_work_order_id", "estimates", ["work_order_id"])
    op.create_index("ix_message_logs_template_id", "message_logs", ["template_id"])
    op.create_index(
        "ix_message_logs_recipient_user_id", "message_logs", ["recipient_user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_message_logs_recipient_user_id", table_name="message_logs")
    op.drop_index("ix_message_logs_template_id", table_name="message_logs")
    op.drop_index("ix_estimates_work_order_id", table_name="estimates")
    op.drop_index("ix_organizations_plan_id", table_name="organizations")
    op.drop_index("ix_subscriptions_plan_id", table_name="subscriptions")
