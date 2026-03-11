import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class EstimateStatus(enum.StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class Estimate(Base, TenantMixin, TimestampMixin):
    __tablename__ = "estimates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), nullable=True, index=True
    )
    client_email: Mapped[str] = mapped_column(String(255))
    client_name: Mapped[str] = mapped_column(String(255))
    estimate_number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[EstimateStatus] = mapped_column(
        Enum(EstimateStatus, values_callable=lambda e: [m.value for m in e]),
        default=EstimateStatus.DRAFT,
    )
    subtotal: Mapped[int] = mapped_column(Integer, default=0)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    line_items = relationship(
        "EstimateLineItem",
        back_populates="estimate",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="EstimateLineItem.sort_order",
    )
    work_order = relationship("WorkOrder", lazy="selectin")
