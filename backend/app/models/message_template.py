import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class TriggerType(enum.StrEnum):
    MANUAL = "manual"
    STAGE_CHANGE = "stage_change"


class ChannelType(enum.StrEnum):
    EMAIL = "email"
    IN_APP = "in_app"
    BOTH = "both"


class MessageTemplate(Base, TenantMixin, TimestampMixin):
    __tablename__ = "message_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    trigger_type: Mapped[TriggerType] = mapped_column(
        Enum(TriggerType, values_callable=lambda e: [m.value for m in e]),
        default=TriggerType.MANUAL,
    )
    trigger_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("kanban_stages.id"), nullable=True
    )
    channel: Mapped[ChannelType] = mapped_column(
        Enum(ChannelType, values_callable=lambda e: [m.value for m in e]),
        default=ChannelType.EMAIL,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    trigger_stage = relationship("KanbanStage", lazy="selectin")
