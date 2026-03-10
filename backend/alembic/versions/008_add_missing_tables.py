"""add missing tables: subscriptions, payment_methods, api_keys,
api_key_usage_logs, clients, webhooks, webhook_deliveries,
and work_orders.client_id column

Revision ID: 008
Revises: 007
Create Date: 2026-03-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def _create_enum_if_not_exists(name: str, values: list[str]) -> None:
    vals = ", ".join(f"'{v}'" for v in values)
    op.execute(
        sa.text(
            f"DO $$ BEGIN "
            f"CREATE TYPE {name} AS ENUM ({vals}); "
            f"EXCEPTION WHEN duplicate_object THEN NULL; "
            f"END $$"
        )
    )


def upgrade() -> None:
    # --- clients (must come before work_orders FK) ---
    _create_enum_if_not_exists("clienttype", ["personal", "business"])
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "client_type",
            postgresql.ENUM(
                "personal", "business", name="clienttype", create_type=False
            ),
            server_default="personal",
        ),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSONB(), server_default="[]", nullable=True),
        sa.Column("referral_source", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column(
            "parent_id",
            sa.Uuid(),
            sa.ForeignKey("clients.id"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- work_orders.client_id FK ---
    op.add_column(
        "work_orders",
        sa.Column(
            "client_id",
            sa.Uuid(),
            sa.ForeignKey("clients.id"),
            nullable=True,
            index=True,
        ),
    )

    # --- subscriptions ---
    _create_enum_if_not_exists(
        "subscriptionstatus",
        ["active", "past_due", "canceled", "trialing"],
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("plan_id", sa.Uuid(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "past_due",
                "canceled",
                "trialing",
                name="subscriptionstatus",
                create_type=False,
            ),
            server_default="active",
        ),
        sa.Column(
            "current_period_start",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default="false"),
        sa.Column("trial_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- payment_methods ---
    _create_enum_if_not_exists("paymentmethodtype", ["card", "bank"])
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "type",
            postgresql.ENUM(
                "card", "bank", name="paymentmethodtype", create_type=False
            ),
            server_default="card",
        ),
        sa.Column("last_four", sa.String(4), nullable=False),
        sa.Column("brand", sa.String(50), server_default=""),
        sa.Column("exp_month", sa.Integer(), server_default="0"),
        sa.Column("exp_year", sa.Integer(), server_default="0"),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- api_keys ---
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(8), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("scopes", postgresql.JSONB(), server_default="[]"),
        sa.Column("rate_limit_per_minute", sa.Integer(), server_default="60"),
        sa.Column("rate_limit_per_day", sa.Integer(), server_default="10000"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            sa.Uuid(),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- api_key_usage_logs ---
    op.create_table(
        "api_key_usage_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "api_key_id",
            sa.Uuid(),
            sa.ForeignKey("api_keys.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("endpoint", sa.String(500), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_time_ms", sa.Float(), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- webhooks ---
    op.create_table(
        "webhooks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("secret", sa.String(255), nullable=False),
        sa.Column("events", postgresql.JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- webhook_deliveries ---
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "webhook_id",
            sa.Uuid(),
            sa.ForeignKey("webhooks.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), server_default="false"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("webhook_deliveries")
    op.drop_table("webhooks")
    op.drop_table("api_key_usage_logs")
    op.drop_table("api_keys")
    op.drop_table("payment_methods")
    op.drop_table("subscriptions")
    op.drop_column("work_orders", "client_id")
    op.drop_table("clients")
    sa.Enum(name="paymentmethodtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="subscriptionstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="clienttype").drop(op.get_bind(), checkfirst=True)
