import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class RenderStatus(enum.StrEnum):
    PENDING = "pending"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class Render(Base, TenantMixin, TimestampMixin):
    __tablename__ = "renders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), index=True, nullable=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clients.id"), index=True, nullable=True
    )
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("vehicles.id"), nullable=True
    )
    design_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RenderStatus] = mapped_column(
        Enum(RenderStatus, values_callable=lambda e: [m.value for m in e]),
        default=RenderStatus.PENDING,
    )
    vehicle_photo_key: Mapped[str] = mapped_column(String(500))
    wrap_design_key: Mapped[str] = mapped_column(String(500))
    result_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    share_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )

    creator = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
    client = relationship("Client", lazy="selectin")
    vehicle = relationship("Vehicle", lazy="selectin")
