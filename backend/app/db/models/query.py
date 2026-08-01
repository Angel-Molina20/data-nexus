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


class QueryCompilation(Base):
    __tablename__ = "query_compilations"
    __table_args__ = (
        Index("ix_query_compilations_query_compiled", "saved_query_id", "compiled_at"),
        Index("ix_query_compilations_fingerprint", "compilation_fingerprint"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    saved_query_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("saved_queries.id", ondelete="CASCADE"), index=True
    )
    query_revision: Mapped[int | None] = mapped_column(Integer)
    query_fingerprint: Mapped[str] = mapped_column(String(64))
    compilation_fingerprint: Mapped[str] = mapped_column(String(64))
    compiler_version: Mapped[str] = mapped_column(String(24))
    engine: Mapped[str] = mapped_column(String(32))
    provider: Mapped[str] = mapped_column(String(32))
    server_version: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(24), default="success")
    sql_template: Mapped[str] = mapped_column(Text)
    parameter_metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    warnings_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    errors_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    capabilities_used_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    complexity_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    compiled_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    compiled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    duration_ms: Mapped[int] = mapped_column(Integer)
