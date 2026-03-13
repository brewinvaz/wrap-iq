import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum, Integer, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin
from app.models.vehicle import VehicleType
from app.models.work_order import JobType
from app.models.wrap_details import WrapCoverage


class EstimateDefaults(Base, TenantMixin, TimestampMixin):
    __tablename__ = "estimate_defaults"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_type: Mapped[JobType | None] = mapped_column(
        Enum(JobType, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    vehicle_count_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vehicle_count_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wrap_coverage: Mapped[WrapCoverage | None] = mapped_column(
        Enum(WrapCoverage, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    vehicle_type: Mapped[VehicleType | None] = mapped_column(
        Enum(VehicleType, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    design_hours: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    production_hours: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    install_hours: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
