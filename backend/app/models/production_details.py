import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class ProductionDetails(Base, TenantMixin, TimestampMixin):
    __tablename__ = "production_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), unique=True, index=True
    )
    assigned_equipment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    print_media_brand_type: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    print_media_width: Mapped[str | None] = mapped_column(String(50), nullable=True)
    laminate_brand_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    laminate_width: Mapped[str | None] = mapped_column(String(50), nullable=True)
    window_perf_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    media_print_length: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    media_ink_fill_percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    sq_ft_printed_and_waste: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    work_order = relationship("WorkOrder", back_populates="production_details")
