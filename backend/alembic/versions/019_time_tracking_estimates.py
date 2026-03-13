"""time tracking estimates

Revision ID: 019
Revises: fe6cd8259ff7
Create Date: 2026-03-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "019"
down_revision: str = "fe6cd8259ff7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add phase, estimated_hours, hourly_cost, estimate_defaults."""

    # --- 1. Add phase enum and column to time_logs ---
    phase_enum = postgresql.ENUM(
        "design", "production", "install", "other",
        name="phase",
        create_type=False,
    )
    phase_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "time_logs",
        sa.Column("phase", phase_enum, nullable=True),
    )

    # --- 2. Rename design_hours -> estimated_hours on design_details ---
    op.alter_column(
        "design_details",
        "design_hours",
        new_column_name="estimated_hours",
    )

    # --- 3. Add estimated_hours to detail + work_orders tables ---
    for table in (
        "production_details",
        "install_details",
        "work_orders",
    ):
        op.add_column(
            table,
            sa.Column(
                "estimated_hours",
                sa.Numeric(8, 2),
                nullable=True,
            ),
        )

    # --- 4. Add hourly_cost to organizations ---
    op.add_column(
        "organizations",
        sa.Column(
            "hourly_cost", sa.Numeric(8, 2), nullable=True
        ),
    )

    # --- 5. Create estimate_defaults table ---
    jobtype = postgresql.ENUM(
        "commercial", "personal",
        name="jobtype", create_type=False,
    )
    wrapcoverage = postgresql.ENUM(
        "full", "three_quarter", "half",
        "quarter", "spot_graphics",
        name="wrapcoverage", create_type=False,
    )
    vehicletype = postgresql.ENUM(
        "car", "suv", "pickup", "van",
        "utility_van", "box_truck", "semi", "trailer",
        name="vehicletype", create_type=False,
    )
    op.create_table(
        "estimate_defaults",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "job_type", jobtype, nullable=True,
        ),
        sa.Column(
            "vehicle_count_min", sa.Integer(), nullable=True,
        ),
        sa.Column(
            "vehicle_count_max", sa.Integer(), nullable=True,
        ),
        sa.Column(
            "wrap_coverage", wrapcoverage, nullable=True,
        ),
        sa.Column(
            "vehicle_type", vehicletype, nullable=True,
        ),
        sa.Column(
            "design_hours",
            sa.Numeric(8, 2), nullable=True,
        ),
        sa.Column(
            "production_hours",
            sa.Numeric(8, 2), nullable=True,
        ),
        sa.Column(
            "install_hours",
            sa.Numeric(8, 2), nullable=True,
        ),
        sa.Column(
            "priority",
            sa.Integer(), nullable=False, server_default="0",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
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
    op.create_index(
        "ix_estimate_defaults_organization_id",
        "estimate_defaults",
        ["organization_id"],
    )

    # --- 6. Migrate InstallTimeLog data into TimeLog ---
    op.execute(
        """
        INSERT INTO time_logs (
            id, organization_id, user_id, work_order_id,
            task, hours, log_date, status, phase, notes,
            created_at, updated_at
        )
        SELECT
            itl.id,
            id2.organization_id,
            itl.user_id,
            id2.work_order_id,
            itl.log_type::text,
            itl.hours,
            itl.created_at::date,
            'submitted',
            'install',
            itl.notes,
            itl.created_at,
            itl.updated_at
        FROM install_time_logs itl
        JOIN install_details id2
            ON id2.id = itl.install_details_id
        """
    )


def downgrade() -> None:
    """Reverse all changes from upgrade."""

    # --- 6. Data migration not reversed (lossy) ---

    # --- 5. Drop estimate_defaults ---
    op.drop_index(
        "ix_estimate_defaults_organization_id",
        table_name="estimate_defaults",
    )
    op.drop_table("estimate_defaults")

    # --- 4. Remove hourly_cost from organizations ---
    op.drop_column("organizations", "hourly_cost")

    # --- 3. Remove estimated_hours ---
    for table in (
        "work_orders",
        "install_details",
        "production_details",
    ):
        op.drop_column(table, "estimated_hours")

    # --- 2. Rename estimated_hours -> design_hours ---
    op.alter_column(
        "design_details",
        "estimated_hours",
        new_column_name="design_hours",
    )

    # --- 1. Remove phase column and enum ---
    op.drop_column("time_logs", "phase")
    op.execute("DROP TYPE IF EXISTS phase")
