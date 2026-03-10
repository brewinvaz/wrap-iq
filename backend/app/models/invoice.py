import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class InvoiceStatus(enum.StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


class Invoice(Base, TenantMixin, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    estimate_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("estimates.id"), nullable=True
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), nullable=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), index=True)
    client_email: Mapped[str] = mapped_column(String(255))
    client_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT
    )
    subtotal: Mapped[int] = mapped_column(Integer, default=0)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0"))
    tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    amount_paid: Mapped[int] = mapped_column(Integer, default=0)
    balance_due: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    estimate = relationship("Estimate", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
    payments = relationship(
        "Payment",
        back_populates="invoice",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
