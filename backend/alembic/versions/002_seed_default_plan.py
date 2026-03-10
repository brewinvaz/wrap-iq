"""seed default free plan

Revision ID: 002
Revises: 001
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO plans (id, name, features, price_cents, is_default, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                'Free',
                '{"max_projects": 50, "max_users": 5}'::jsonb,
                0,
                true,
                now(),
                now()
            )
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM plans WHERE name = 'Free' AND is_default = true"))
