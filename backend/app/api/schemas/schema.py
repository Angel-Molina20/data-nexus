import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SynchronizationResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    status: str
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    entities_discovered: int
    fields_discovered: int
    indexes_discovered: int
    relationships_discovered: int
    entities_added: int
    entities_updated: int
    entities_removed: int
    fields_added: int
    fields_updated: int
    fields_removed: int
    warnings: list[str]
    error_code: str | None
    error_message: str | None


class SchemaSummaryResponse(BaseModel):
    connection_id: uuid.UUID
    connection_name: str
    engine: str
    raw_version: str | None
    last_synchronized_at: datetime | None
    status: str | None
    tables: int
    views: int
    inactive_entities: int
    fields: int
    indexes: int
    physical_relationships: int
    latest_added: int
    latest_updated: int
    latest_removed: int
    warnings: list[str]


class EntitySummaryResponse(BaseModel):
    id: uuid.UUID
    schema_name: str
    physical_name: str
    display_name: str
    entity_type: str
    is_active: bool
    fields_count: int
    has_primary_key: bool
    indexes_count: int
    relationships_count: int


class EntityListResponse(BaseModel):
    items: list[EntitySummaryResponse]
    total: int
    page: int
    page_size: int


class FieldResponse(BaseModel):
    id: uuid.UUID
    physical_name: str
    display_name: str
    ordinal_position: int
    native_data_type: str
    normalized_data_type: str
    column_type: str
    is_nullable: bool
    default_value: Any | None
    is_primary_key: bool
    is_unique: bool
    is_auto_increment: bool
    comment: str | None
    is_active: bool


class IndexFieldResponse(BaseModel):
    field_name: str | None
    sequence: int
    sort_direction: str | None
    prefix_length: int | None


class IndexResponse(BaseModel):
    id: uuid.UUID
    physical_name: str
    index_type: str | None
    is_unique: bool
    is_primary: bool
    is_active: bool
    fields: list[IndexFieldResponse]


class RelationshipFieldResponse(BaseModel):
    source_field: str
    target_field: str
    sequence: int


class RelationshipResponse(BaseModel):
    id: uuid.UUID
    constraint_name: str
    source_entity_id: uuid.UUID
    source_entity: str
    target_entity_id: uuid.UUID
    target_entity: str
    update_rule: str | None
    delete_rule: str | None
    is_active: bool
    fields: list[RelationshipFieldResponse]


class EntityDetailResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    physical_name: str
    display_name: str
    entity_type: str
    engine: str
    schema_name: str
    comment: str | None
    estimated_rows: int | None
    storage_engine: str | None
    collation: str | None
    is_active: bool
    first_seen_at: datetime
    last_seen_at: datetime
    fields: list[FieldResponse]
    indexes: list[IndexResponse]
    incoming_relationships: list[RelationshipResponse]
    outgoing_relationships: list[RelationshipResponse]


class SynchronizationListResponse(BaseModel):
    items: list[SynchronizationResponse]
    total: int
    page: int
    page_size: int


class ChangeResponse(BaseModel):
    id: uuid.UUID
    synchronization_id: uuid.UUID
    change_type: str
    object_type: str
    object_id: uuid.UUID
    physical_name: str
    previous_value: dict[str, Any] | None
    current_value: dict[str, Any] | None
    created_at: datetime


class ChangeListResponse(BaseModel):
    items: list[ChangeResponse]
    total: int
    page: int
    page_size: int


class RelationshipListResponse(BaseModel):
    items: list[RelationshipResponse]
    total: int
