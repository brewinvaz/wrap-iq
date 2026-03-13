import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class Phase(enum.StrEnum):
    DESIGN = "design"
    PRODUCTION = "production"
    INSTALL = "install"
    OTHER = "other"


class TimeLogStatus(enum.StrEnum):
    SUBMITTED = "submitted"
    APPROVED = "approved"


class TimeLog(Base, TenantMixin, TimestampMixin):
    __tablename__ = "time_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), index=True, nullable=True
    )
    task: Mapped[str] = mapped_column(String(255))
    hours: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    log_date: Mapped[date] = mapped_column(Date)
    status: Mapped[TimeLogStatus] = mapped_column(
        Enum(TimeLogStatus, values_callable=lambda e: [m.value for m in e]),
        default=TimeLogStatus.SUBMITTED,
    )
    phase: Mapped[Phase | None] = mapped_column(
        Enum(Phase, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
