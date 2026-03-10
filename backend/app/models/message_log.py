import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin
from app.models.message_template import ChannelType


class MessageStatus(enum.StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class MessageLog(Base, TenantMixin):
    __tablename__ = "message_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("message_templates.id"), nullable=True, index=True
    )
    recipient_email: Mapped[str] = mapped_column(String(255))
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, index=True
    )
    subject: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    channel: Mapped[ChannelType] = mapped_column(Enum(ChannelType))
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus), default=MessageStatus.PENDING
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    template = relationship("MessageTemplate", lazy="selectin")
    recipient_user = relationship("User", lazy="selectin")
