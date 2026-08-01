import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DatabaseConnection(Base):
    __tablename__ = "database_connections"
    __table_args__ = (
        Index("ix_database_connections_status", "status"),
        Index("ix_database_connections_engine_provider", "engine", "provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    engine: Mapped[str] = mapped_column(String(32), default="mysql")
    provider: Mapped[str] = mapped_column(String(32), default="unknown")
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(Integer)
    database_name: Mapped[str] = mapped_column(String(128))
    username: Mapped[str] = mapped_column(String(128))
    encrypted_password: Mapped[str] = mapped_column(Text)
    ssl_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    configuration_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    raw_version: Mapped[str | None] = mapped_column(String(255))
    major_version: Mapped[int | None] = mapped_column(Integer)
    minor_version: Mapped[int | None] = mapped_column(Integer)
    patch_version: Mapped[int | None] = mapped_column(Integer)
    version_comment: Mapped[str | None] = mapped_column(String(255))
    sql_mode: Mapped[str | None] = mapped_column(Text)
    character_set: Mapped[str | None] = mapped_column(String(64))
    collation: Mapped[str | None] = mapped_column("collation", String(128), quote=True)
    timezone: Mapped[str | None] = mapped_column(String(64))
    capabilities_json: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="disconnected")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    last_error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
