import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class JobType(enum.StrEnum):
    COMMERCIAL = "commercial"
    PERSONAL = "personal"


class Priority(enum.StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class WorkOrder(Base, TenantMixin, TimestampMixin):
    __tablename__ = "work_orders"
    __table_args__ = (
        sa.UniqueConstraint(
            "organization_id", "job_number", name="uq_work_order_org_job_number"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_number: Mapped[str] = mapped_column(String(50), index=True)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType), default=JobType.PERSONAL)
    job_value: Mapped[int] = mapped_column(Integer, default=0)
    status_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("kanban_stages.id"), index=True
    )
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.MEDIUM)
    date_in: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estimated_completion_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completion_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_photos: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_photos: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status_timestamps: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status = relationship("KanbanStage", lazy="selectin")
    work_order_vehicles = relationship(
        "WorkOrderVehicle", back_populates="work_order", lazy="selectin"
    )
    wrap_details = relationship("WrapDetails", lazy="selectin")
    design_details = relationship(
        "DesignDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )
    production_details = relationship(
        "ProductionDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )
    install_details = relationship(
        "InstallDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )


class WorkOrderVehicle(Base):
    __tablename__ = "work_order_vehicles"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), primary_key=True
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    work_order = relationship("WorkOrder", back_populates="work_order_vehicles")
    vehicle = relationship("Vehicle", lazy="selectin")
