import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SavedQuery(Base):
    __tablename__ = "saved_queries"
    __table_args__ = (
        Index("ix_saved_queries_owner_status", "owner_user_id", "status"),
        Index("ix_saved_queries_connection_updated", "connection_id", "updated_at"),
        UniqueConstraint(
            "owner_user_id", "connection_id", "name", name="uq_saved_query_owner_name"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="RESTRICT"), index=True
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    query_document_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    schema_version: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    validation_status: Mapped[str] = mapped_column(String(24), default="not_validated")
    validation_errors_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    validation_warnings_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    complexity_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
