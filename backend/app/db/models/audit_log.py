import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    actor: Mapped[str] = mapped_column(String(128), default="system")
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(80), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(128))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    result: Mapped[str] = mapped_column(String(32))
    duration_ms: Mapped[int] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
