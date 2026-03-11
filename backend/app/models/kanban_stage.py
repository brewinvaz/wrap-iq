import enum
import uuid

from sqlalchemy import Boolean, Enum, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class SystemStatus(enum.StrEnum):
    LEAD = "LEAD"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class KanbanStage(Base, TenantMixin, TimestampMixin):
    __tablename__ = "kanban_stages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    color: Mapped[str] = mapped_column(String(7), default="#64748b")
    position: Mapped[int] = mapped_column(Integer, default=0)
    system_status: Mapped[SystemStatus | None] = mapped_column(
        Enum(SystemStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
