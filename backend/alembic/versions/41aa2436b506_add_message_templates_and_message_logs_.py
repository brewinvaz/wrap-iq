"""add message_templates and message_logs tables

Revision ID: 41aa2436b506
Revises: 09c2a95d9019
Create Date: 2026-03-10 02:33:14.318200

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '41aa2436b506'
down_revision: str | Sequence[str] | None = '09c2a95d9019'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('message_templates',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('subject', sa.String(length=500), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('trigger_type', sa.Enum('manual', 'stage_change', name='triggertype'), nullable=False),
    sa.Column('trigger_stage_id', sa.Uuid(), nullable=True),
    sa.Column('channel', sa.Enum('email', 'in_app', 'both', name='channeltype'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['trigger_stage_id'], ['kanban_stages.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_message_templates_organization_id'), 'message_templates', ['organization_id'], unique=False)
    op.create_table('message_logs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('template_id', sa.Uuid(), nullable=True),
    sa.Column('recipient_email', sa.String(length=255), nullable=False),
    sa.Column('recipient_user_id', sa.Uuid(), nullable=True),
    sa.Column('subject', sa.String(length=500), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('channel', sa.Enum('email', 'in_app', 'both', name='channeltype', create_type=False), nullable=False),
    sa.Column('status', sa.Enum('pending', 'sent', 'failed', name='messagestatus'), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['recipient_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['template_id'], ['message_templates.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_message_logs_organization_id'), 'message_logs', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_message_logs_organization_id'), table_name='message_logs')
    op.drop_table('message_logs')
    op.drop_index(op.f('ix_message_templates_organization_id'), table_name='message_templates')
    op.drop_table('message_templates')
    sa.Enum(name='messagestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='channeltype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='triggertype').drop(op.get_bind(), checkfirst=True)
