import uuid

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class FileUpload(Base, TenantMixin, TimestampMixin):
    __tablename__ = "file_uploads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), nullable=True, index=True
    )
    r2_key: Mapped[str] = mapped_column(String(1024), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    photo_type: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    uploader = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
