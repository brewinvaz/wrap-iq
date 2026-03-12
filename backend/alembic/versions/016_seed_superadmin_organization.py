"""seed superadmin organization and set user names

Revision ID: 016
Revises: 015
Create Date: 2026-03-12
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: str = "015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORG_NAME = "BlueMintIQ"
ORG_SLUG = "bluemintiq"

SUPERADMINS = {
    "brewin@bluemintiq.com": "Brewin Vaz",
    "rini@bluemintiq.com": "Rini Gahir",
}


def upgrade() -> None:
    conn = op.get_bind()

    # Get the default free plan
    plan_row = conn.execute(
        sa.text("SELECT id FROM plans WHERE is_default = true LIMIT 1")
    ).fetchone()
    if plan_row is None:
        return
    plan_id = plan_row[0]

    # Create org for superadmins
    result = conn.execute(
        sa.text(
            """
            INSERT INTO organizations (id, name, slug, plan_id, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :slug, :plan_id, true, now(), now())
            RETURNING id
            """
        ),
        {"name": ORG_NAME, "slug": ORG_SLUG, "plan_id": plan_id},
    )
    org_id = result.fetchone()[0]

    # Link superadmins to org and set full names
    for email, full_name in SUPERADMINS.items():
        conn.execute(
            sa.text(
                """
                UPDATE users
                SET organization_id = :org_id, full_name = :full_name
                WHERE email = :email AND organization_id IS NULL
                """
            ),
            {"org_id": org_id, "email": email, "full_name": full_name},
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Unlink superadmins
    for email in SUPERADMINS:
        conn.execute(
            sa.text(
                """
                UPDATE users SET organization_id = NULL, full_name = NULL
                WHERE email = :email
                """
            ),
            {"email": email},
        )

    # Remove org
    conn.execute(
        sa.text("DELETE FROM organizations WHERE slug = :slug"),
        {"slug": ORG_SLUG},
    )
