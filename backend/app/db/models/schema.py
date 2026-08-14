import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SchemaSynchronization(Base):
    __tablename__ = "schema_synchronizations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(40), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    entities_discovered: Mapped[int] = mapped_column(Integer, default=0)
    fields_discovered: Mapped[int] = mapped_column(Integer, default=0)
    relationships_discovered: Mapped[int] = mapped_column(Integer, default=0)
    indexes_discovered: Mapped[int] = mapped_column(Integer, default=0)
    entities_added: Mapped[int] = mapped_column(Integer, default=0)
    entities_updated: Mapped[int] = mapped_column(Integer, default=0)
    entities_removed: Mapped[int] = mapped_column(Integer, default=0)
    fields_added: Mapped[int] = mapped_column(Integer, default=0)
    fields_updated: Mapped[int] = mapped_column(Integer, default=0)
    fields_removed: Mapped[int] = mapped_column(Integer, default=0)
    warnings_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchemaEntity(Base):
    __tablename__ = "schema_entities"
    __table_args__ = (
        UniqueConstraint(
            "connection_id", "schema_name", "physical_name", name="uq_schema_entity_key"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    physical_name: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    engine: Mapped[str] = mapped_column(String(32))
    schema_name: Mapped[str] = mapped_column(String(255))
    comment: Mapped[str | None] = mapped_column(Text)
    estimated_rows: Mapped[int | None] = mapped_column(Integer)
    storage_engine: Mapped[str | None] = mapped_column(String(64))
    collation: Mapped[str | None] = mapped_column("collation", String(128), quote=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaField(Base):
    __tablename__ = "schema_fields"
    __table_args__ = (UniqueConstraint("entity_id", "physical_name", name="uq_schema_field_key"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    physical_name: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    ordinal_position: Mapped[int] = mapped_column(Integer)
    native_data_type: Mapped[str] = mapped_column(String(128))
    normalized_data_type: Mapped[str] = mapped_column(String(32))
    column_type: Mapped[str] = mapped_column(Text)
    is_nullable: Mapped[bool] = mapped_column(Boolean)
    default_value: Mapped[Any | None] = mapped_column(JSON)
    is_primary_key: Mapped[bool] = mapped_column(Boolean)
    is_unique: Mapped[bool] = mapped_column(Boolean)
    is_auto_increment: Mapped[bool] = mapped_column(Boolean)
    character_maximum_length: Mapped[int | None] = mapped_column(BigInteger)
    numeric_precision: Mapped[int | None] = mapped_column(Integer)
    numeric_scale: Mapped[int | None] = mapped_column(Integer)
    datetime_precision: Mapped[int | None] = mapped_column(Integer)
    character_set: Mapped[str | None] = mapped_column(String(64))
    collation: Mapped[str | None] = mapped_column("collation", String(128), quote=True)
    comment: Mapped[str | None] = mapped_column(Text)
    extra: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaIndex(Base):
    __tablename__ = "schema_indexes"
    __table_args__ = (UniqueConstraint("entity_id", "physical_name", name="uq_schema_index_key"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    physical_name: Mapped[str] = mapped_column(String(255))
    index_type: Mapped[str | None] = mapped_column(String(64))
    is_unique: Mapped[bool] = mapped_column(Boolean)
    is_primary: Mapped[bool] = mapped_column(Boolean)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaIndexField(Base):
    __tablename__ = "schema_index_fields"
    __table_args__ = (
        UniqueConstraint("index_id", "sequence", name="uq_schema_index_field_sequence"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    index_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_indexes.id", ondelete="CASCADE"), index=True
    )
    field_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer)
    sort_direction: Mapped[str | None] = mapped_column(String(8))
    prefix_length: Mapped[int | None] = mapped_column(Integer)


class SchemaPhysicalRelationship(Base):
    __tablename__ = "schema_physical_relationships"
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "constraint_name",
            "source_entity_id",
            "target_entity_id",
            name="uq_schema_relationship_key",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    constraint_name: Mapped[str] = mapped_column(String(255))
    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    target_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    update_rule: Mapped[str | None] = mapped_column(String(32))
    delete_rule: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaRelationshipField(Base):
    __tablename__ = "schema_relationship_fields"
    __table_args__ = (
        UniqueConstraint(
            "relationship_id", "sequence", name="uq_schema_relationship_field_sequence"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    relationship_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_physical_relationships.id", ondelete="CASCADE"), index=True
    )
    source_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE")
    )
    target_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE")
    )
    sequence: Mapped[int] = mapped_column(Integer)


class SchemaChange(Base):
    __tablename__ = "schema_changes"
    __table_args__ = (Index("ix_schema_changes_type", "change_type", "object_type"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    synchronization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_synchronizations.id", ondelete="CASCADE"), index=True
    )
    change_type: Mapped[str] = mapped_column(String(32))
    object_type: Mapped[str] = mapped_column(String(32))
    object_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    physical_name: Mapped[str] = mapped_column(String(512))
    previous_value_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    current_value_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
