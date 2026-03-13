"""add task_presets table

Revision ID: edaf2918014c
Revises: 019
Create Date: 2026-03-13 15:37:16.297513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'edaf2918014c'
down_revision: Union[str, Sequence[str], None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Re-use the existing 'phase' enum from time_logs table
phase_enum = postgresql.ENUM('design', 'production', 'install', 'other', name='phase', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('task_presets',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('phase', phase_enum, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('organization_id', 'phase', 'name', name='uq_task_preset_org_phase_name')
    )
    op.create_index('ix_task_preset_org_phase', 'task_presets', ['organization_id', 'phase'], unique=False)
    op.create_index(op.f('ix_task_presets_organization_id'), 'task_presets', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_task_presets_organization_id'), table_name='task_presets')
    op.drop_index('ix_task_preset_org_phase', table_name='task_presets')
    op.drop_table('task_presets')
