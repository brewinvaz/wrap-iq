"""add equipment table and production detail FKs

Revision ID: fe6cd8259ff7
Revises: 018
Create Date: 2026-03-13 15:06:42.168533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe6cd8259ff7'
down_revision: Union[str, Sequence[str], None] = '018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create equipment table
    op.create_table('equipment',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('serial_number', sa.String(length=255), nullable=True),
        sa.Column('equipment_type', sa.Enum('printer', 'laminator', 'plotter', 'other', name='equipmenttype'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_equipment_organization_id'), 'equipment', ['organization_id'], unique=False)

    # Add equipment FK columns to production_details
    op.add_column('production_details', sa.Column('printer_id', sa.Uuid(), nullable=True))
    op.add_column('production_details', sa.Column('laminator_id', sa.Uuid(), nullable=True))
    op.add_column('production_details', sa.Column('plotter_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_production_details_printer_id', 'production_details', 'equipment', ['printer_id'], ['id'])
    op.create_foreign_key('fk_production_details_laminator_id', 'production_details', 'equipment', ['laminator_id'], ['id'])
    op.create_foreign_key('fk_production_details_plotter_id', 'production_details', 'equipment', ['plotter_id'], ['id'])

    # Drop old assigned_equipment column
    op.drop_column('production_details', 'assigned_equipment')


def downgrade() -> None:
    """Downgrade schema."""
    # Restore assigned_equipment column
    op.add_column('production_details', sa.Column('assigned_equipment', sa.VARCHAR(length=255), autoincrement=False, nullable=True))

    # Drop equipment FK columns from production_details
    op.drop_constraint('fk_production_details_plotter_id', 'production_details', type_='foreignkey')
    op.drop_constraint('fk_production_details_laminator_id', 'production_details', type_='foreignkey')
    op.drop_constraint('fk_production_details_printer_id', 'production_details', type_='foreignkey')
    op.drop_column('production_details', 'plotter_id')
    op.drop_column('production_details', 'laminator_id')
    op.drop_column('production_details', 'printer_id')

    # Drop equipment table
    op.drop_index(op.f('ix_equipment_organization_id'), table_name='equipment')
    op.drop_table('equipment')
