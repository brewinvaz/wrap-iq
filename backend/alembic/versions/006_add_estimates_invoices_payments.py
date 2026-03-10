"""add estimates invoices payments tables and org tax rate

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    estimatestatus = postgresql.ENUM(
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        name="estimatestatus",
        create_type=False,
    )
    estimatestatus.create(op.get_bind(), checkfirst=True)

    invoicestatus = postgresql.ENUM(
        "draft",
        "sent",
        "viewed",
        "partial",
        "paid",
        "overdue",
        "void",
        name="invoicestatus",
        create_type=False,
    )
    invoicestatus.create(op.get_bind(), checkfirst=True)

    # Add default_tax_rate to organizations
    op.add_column(
        "organizations",
        sa.Column(
            "default_tax_rate",
            sa.Numeric(precision=5, scale=4),
            nullable=True,
        ),
    )

    # Create estimates table
    op.create_table(
        "estimates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            sa.Uuid(),
            sa.ForeignKey("work_orders.id"),
            nullable=True,
        ),
        sa.Column(
            "client_email",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "client_name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "estimate_number",
            sa.String(50),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "status",
            estimatestatus,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "tax_rate",
            sa.Numeric(precision=5, scale=4),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "tax_amount",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "valid_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "responded_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create estimate_line_items table
    op.create_table(
        "estimate_line_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "estimate_id",
            sa.Uuid(),
            sa.ForeignKey("estimates.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column(
            "quantity",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "unit_price",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create invoices table
    op.create_table(
        "invoices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "estimate_id",
            sa.Uuid(),
            sa.ForeignKey("estimates.id"),
            nullable=True,
        ),
        sa.Column(
            "work_order_id",
            sa.Uuid(),
            sa.ForeignKey("work_orders.id"),
            nullable=True,
        ),
        sa.Column(
            "invoice_number",
            sa.String(50),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "client_email",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "client_name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "status",
            invoicestatus,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "tax_rate",
            sa.Numeric(precision=5, scale=4),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "tax_amount",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "amount_paid",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "balance_due",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("payment_link", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create payments table
    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "invoice_id",
            sa.Uuid(),
            sa.ForeignKey("invoices.id"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("invoices")
    op.drop_table("estimate_line_items")
    op.drop_table("estimates")
    op.drop_column("organizations", "default_tax_rate")

    op.execute("DROP TYPE IF EXISTS invoicestatus")
    op.execute("DROP TYPE IF EXISTS estimatestatus")
