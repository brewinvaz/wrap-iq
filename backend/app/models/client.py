import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class ClientType(enum.StrEnum):
    PERSONAL = "personal"
    BUSINESS = "business"


class Client(Base, TenantMixin, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_type: Mapped[ClientType] = mapped_column(
        Enum(ClientType), default=ClientType.PERSONAL
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, server_default="[]", nullable=True)
    referral_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clients.id"), nullable=True, index=True
    )

    parent = relationship("Client", remote_side=[id], back_populates="sub_clients")
    sub_clients = relationship("Client", back_populates="parent", lazy="selectin")
    work_orders = relationship("WorkOrder", back_populates="client", lazy="selectin")
