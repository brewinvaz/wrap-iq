"""add project data models

Revision ID: 005
Revises: 004
Create Date: 2026-03-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    vehicletype = postgresql.ENUM(
        "car", "suv", "pickup", "van", "utility_van", "box_truck", "semi", "trailer",
        name="vehicletype",
        create_type=False,
    )
    vehicletype.create(op.get_bind(), checkfirst=True)

    jobtype = postgresql.ENUM("commercial", "personal", name="jobtype", create_type=False)
    jobtype.create(op.get_bind(), checkfirst=True)

    priority = postgresql.ENUM("high", "medium", "low", name="priority", create_type=False)
    priority.create(op.get_bind(), checkfirst=True)

    wrapcoverage = postgresql.ENUM(
        "full", "three_quarter", "half", "quarter", "spot_graphics",
        name="wrapcoverage",
        create_type=False,
    )
    wrapcoverage.create(op.get_bind(), checkfirst=True)

    roof_coverage_level = postgresql.ENUM(
        "no", "partial", "full", name="roof_coverage_level", create_type=False
    )
    roof_coverage_level.create(op.get_bind(), checkfirst=True)

    door_handle_coverage = postgresql.ENUM(
        "no", "partial", "full", name="door_handle_coverage", create_type=False
    )
    door_handle_coverage.create(op.get_bind(), checkfirst=True)

    windowcoverage = postgresql.ENUM(
        "no", "solid_vinyl", "perforated_vinyl", name="windowcoverage", create_type=False
    )
    windowcoverage.create(op.get_bind(), checkfirst=True)

    bumpercoverage = postgresql.ENUM(
        "no", "front", "back", "both", name="bumpercoverage", create_type=False
    )
    bumpercoverage.create(op.get_bind(), checkfirst=True)

    installlocation = postgresql.ENUM(
        "in_shop", "on_site", name="installlocation", create_type=False
    )
    installlocation.create(op.get_bind(), checkfirst=True)

    installdifficulty = postgresql.ENUM(
        "easy", "standard", "complex", name="installdifficulty", create_type=False
    )
    installdifficulty.create(op.get_bind(), checkfirst=True)

    logtype = postgresql.ENUM(
        "demo_removal", "prep", "install", name="logtype", create_type=False
    )
    logtype.create(op.get_bind(), checkfirst=True)

    # vehicles
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("vin", sa.String(17), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("make", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("vehicle_unit_number", sa.String(50), nullable=True),
        sa.Column("vehicle_type", vehicletype, nullable=True),
        sa.Column("truck_cab_size", sa.String(50), nullable=True),
        sa.Column("truck_bed_length", sa.String(50), nullable=True),
        sa.Column("van_roof_height", sa.String(50), nullable=True),
        sa.Column("van_wheelbase", sa.String(50), nullable=True),
        sa.Column("van_length", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vehicles_organization_id", "vehicles", ["organization_id"])
    op.create_index("ix_vehicles_vin", "vehicles", ["vin"])
    op.create_index(
        "ix_vehicle_org_vin",
        "vehicles",
        ["organization_id", "vin"],
        unique=True,
        postgresql_where=sa.text("vin IS NOT NULL"),
    )

    # work_orders
    op.create_table(
        "work_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("job_number", sa.String(50), nullable=False),
        sa.Column("job_type", jobtype, nullable=False),
        sa.Column("job_value", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status_id", sa.Uuid(), nullable=False),
        sa.Column("priority", priority, nullable=False),
        sa.Column("date_in", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "estimated_completion_date", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("completion_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("before_photos", postgresql.JSONB(), nullable=True),
        sa.Column("after_photos", postgresql.JSONB(), nullable=True),
        sa.Column("status_timestamps", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["status_id"], ["kanban_stages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id", "job_number", name="uq_work_order_org_job_number"
        ),
    )
    op.create_index(
        "ix_work_orders_organization_id", "work_orders", ["organization_id"]
    )
    op.create_index("ix_work_orders_job_number", "work_orders", ["job_number"])
    op.create_index("ix_work_orders_status_id", "work_orders", ["status_id"])

    # work_order_vehicles
    op.create_table(
        "work_order_vehicles",
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("work_order_id", "vehicle_id"),
    )

    # wrap_details
    op.create_table(
        "wrap_details",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("wrap_coverage", wrapcoverage, nullable=True),
        sa.Column("roof_coverage", roof_coverage_level, nullable=True),
        sa.Column("door_handles", door_handle_coverage, nullable=True),
        sa.Column("window_coverage", windowcoverage, nullable=True),
        sa.Column("bumper_coverage", bumpercoverage, nullable=True),
        sa.Column("misc_items", postgresql.JSONB(), nullable=True),
        sa.Column("special_wrap_instructions", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wrap_details_work_order_id", "wrap_details", ["work_order_id"])
    op.create_index("ix_wrap_details_vehicle_id", "wrap_details", ["vehicle_id"])

    # design_details
    op.create_table(
        "design_details",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("design_hours", sa.Numeric(8, 2), nullable=True),
        sa.Column(
            "design_version_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("revision_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("proofing_data", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_order_id"),
    )
    op.create_index(
        "ix_design_details_work_order_id", "design_details", ["work_order_id"]
    )

    # production_details
    op.create_table(
        "production_details",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_equipment", sa.String(255), nullable=True),
        sa.Column("print_media_brand_type", sa.String(255), nullable=True),
        sa.Column("print_media_width", sa.String(50), nullable=True),
        sa.Column("laminate_brand_type", sa.String(255), nullable=True),
        sa.Column("laminate_width", sa.String(50), nullable=True),
        sa.Column("window_perf_details", postgresql.JSONB(), nullable=True),
        sa.Column("media_print_length", sa.Numeric(10, 2), nullable=True),
        sa.Column("media_ink_fill_percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("sq_ft_printed_and_waste", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_order_id"),
    )
    op.create_index(
        "ix_production_details_work_order_id",
        "production_details",
        ["work_order_id"],
    )

    # install_details
    op.create_table(
        "install_details",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("install_location", installlocation, nullable=True),
        sa.Column("install_difficulty", installdifficulty, nullable=True),
        sa.Column("install_start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("install_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_order_id"),
    )
    op.create_index(
        "ix_install_details_work_order_id", "install_details", ["work_order_id"]
    )

    # install_time_logs
    op.create_table(
        "install_time_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("install_details_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("log_type", logtype, nullable=False),
        sa.Column("hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["install_details_id"], ["install_details.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_install_time_logs_install_details_id",
        "install_time_logs",
        ["install_details_id"],
    )
    op.create_index("ix_install_time_logs_user_id", "install_time_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("install_time_logs")
    op.drop_table("install_details")
    op.drop_table("production_details")
    op.drop_table("design_details")
    op.drop_table("wrap_details")
    op.drop_table("work_order_vehicles")
    op.drop_table("work_orders")
    op.drop_table("vehicles")

    op.execute("DROP TYPE IF EXISTS vehicletype CASCADE")
    op.execute("DROP TYPE IF EXISTS jobtype CASCADE")
    op.execute("DROP TYPE IF EXISTS priority CASCADE")
    op.execute("DROP TYPE IF EXISTS wrapcoverage CASCADE")
    op.execute("DROP TYPE IF EXISTS roof_coverage_level CASCADE")
    op.execute("DROP TYPE IF EXISTS door_handle_coverage CASCADE")
    op.execute("DROP TYPE IF EXISTS windowcoverage CASCADE")
    op.execute("DROP TYPE IF EXISTS bumpercoverage CASCADE")
    op.execute("DROP TYPE IF EXISTS installlocation CASCADE")
    op.execute("DROP TYPE IF EXISTS installdifficulty CASCADE")
    op.execute("DROP TYPE IF EXISTS logtype CASCADE")
