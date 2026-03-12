"""lowercase kanban_stages system_status values

Revision ID: 017
Revises: 016
Create Date: 2026-03-12

The Python SystemStatus enum was changed to lowercase values in commit
6032400, but existing database rows may still contain uppercase values
(LEAD, IN_PROGRESS, COMPLETED, CANCELLED) if the Postgres enum type
was originally created with uppercase members.  This migration
recreates the enum with lowercase values and updates the data.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: str = "016"
# NOTE: In the container the head may be "015" if migrations 016+ haven't
# been copied in yet.  Use `make migrate` after syncing all migration files.
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOWERCASE_VALUES = ("lead", "in_progress", "completed", "cancelled")


def upgrade() -> None:
    # Rename the existing enum (may have uppercase members)
    op.execute("ALTER TYPE systemstatus RENAME TO systemstatus_old")

    # Create new enum with correct lowercase values
    op.execute(
        "CREATE TYPE systemstatus AS ENUM ("
        + ", ".join(f"'{v}'" for v in LOWERCASE_VALUES)
        + ")"
    )

    # Convert column: cast old enum → text → lowercase → new enum
    op.execute(
        "ALTER TABLE kanban_stages "
        "ALTER COLUMN system_status TYPE systemstatus "
        "USING LOWER(system_status::text)::systemstatus"
    )

    # Drop the old enum
    op.execute("DROP TYPE systemstatus_old")


def downgrade() -> None:
    # No-op: lowercase values are the canonical form going forward.
    # Re-uppercasing would break the current Python enum.
    pass
