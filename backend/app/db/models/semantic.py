import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
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


class SemanticRelationship(Base):
    __tablename__ = "semantic_relationships"
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "fingerprint",
            name="uq_semantic_relationship_fingerprint",
        ),
        CheckConstraint(
            "confidence_score >= 0 AND confidence_score <= 1",
            name="ck_semantic_relationship_confidence",
        ),
        Index("ix_semantic_relationship_type_status", "relationship_type", "status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    relationship_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), index=True)
    detection_source: Mapped[str] = mapped_column(String(40))
    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    target_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    display_name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    cardinality: Mapped[str] = mapped_column(String(32))
    confidence_score: Mapped[float] = mapped_column(Float)
    is_bidirectional: Mapped[bool] = mapped_column(Boolean, default=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    conditions_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    reasons_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    warnings_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    fingerprint: Mapped[str] = mapped_column(String(64))
    invalid_reason: Mapped[str | None] = mapped_column(Text)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(String(128), default="system")
    updated_by: Mapped[str] = mapped_column(String(128), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SemanticRelationshipField(Base):
    __tablename__ = "semantic_relationship_fields"
    __table_args__ = (
        UniqueConstraint("relationship_id", "sequence", name="uq_semantic_rel_field_sequence"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    relationship_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("semantic_relationships.id", ondelete="CASCADE"), index=True
    )
    source_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    target_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer)
    comparison_operator: Mapped[str] = mapped_column(String(24), default="equals")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PolymorphicRelationship(Base):
    __tablename__ = "polymorphic_relationships"
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "source_entity_id",
            "type_field_id",
            "id_field_id",
            name="uq_polymorphic_relationship_fields",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    type_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    id_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    display_name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="confirmed")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    invalid_reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    updated_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PolymorphicRelationshipMapping(Base):
    __tablename__ = "polymorphic_relationship_mappings"
    __table_args__ = (
        UniqueConstraint(
            "polymorphic_relationship_id",
            "type_value",
            name="uq_polymorphic_mapping_value",
        ),
        Index("ix_poly_mapping_relationship", "polymorphic_relationship_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    polymorphic_relationship_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("polymorphic_relationships.id", ondelete="CASCADE")
    )
    type_value: Mapped[str] = mapped_column(String(255))
    target_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    target_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SemanticEntity(Base):
    __tablename__ = "semantic_entities"
    __table_args__ = (
        UniqueConstraint("schema_entity_id", name="uq_semantic_entity_schema_entity"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    schema_entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_entities.id", ondelete="CASCADE"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    singular_name: Mapped[str | None] = mapped_column(String(160))
    plural_name: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    business_domain: Mapped[str | None] = mapped_column(String(160), index=True)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    updated_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SemanticField(Base):
    __tablename__ = "semantic_fields"
    __table_args__ = (UniqueConstraint("schema_field_id", name="uq_semantic_field_schema_field"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    schema_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schema_fields.id", ondelete="CASCADE"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    semantic_type: Mapped[str] = mapped_column(String(40), default="unknown")
    format: Mapped[str | None] = mapped_column(String(80))
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    updated_by: Mapped[str] = mapped_column(String(128), default="local-admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
