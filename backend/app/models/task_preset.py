import uuid

import sqlalchemy as sa
from sqlalchemy import Boolean, Enum, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin
from app.models.time_log import Phase


class TaskPreset(Base, TenantMixin, TimestampMixin):
    __tablename__ = "task_presets"
    __table_args__ = (
        sa.UniqueConstraint(
            "organization_id", "phase", "name", name="uq_task_preset_org_phase_name"
        ),
        sa.Index("ix_task_preset_org_phase", "organization_id", "phase"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phase: Mapped[Phase] = mapped_column(
        Enum(Phase, values_callable=lambda e: [m.value for m in e]),
    )
    name: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
