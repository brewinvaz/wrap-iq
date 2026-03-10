"""add onboarding models (user_profiles, client_invites, file_uploads)

Revision ID: 007
Revises: 006, 41aa2436b506
Create Date: 2026-03-10
"""

import sqlalchemy as sa

from alembic import op

revision = "007"
down_revision = ("006", "41aa2436b506")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id"),
            unique=True,
            index=True,
            nullable=False,
        ),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "client_invites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("email", sa.String(255), index=True, nullable=False),
        sa.Column("token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column(
            "invited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "file_uploads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "uploaded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "work_order_id",
            sa.Uuid(),
            sa.ForeignKey("work_orders.id"),
            index=True,
            nullable=True,
        ),
        sa.Column("r2_key", sa.String(1024), unique=True, nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("file_uploads")
    op.drop_table("client_invites")
    op.drop_table("user_profiles")
