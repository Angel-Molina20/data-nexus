from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class EntityType(StrEnum):
    TABLE = "table"
    VIEW = "view"


class SynchronizationStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"


class ChangeType(StrEnum):
    ADDED = "added"
    UPDATED = "updated"
    REMOVED = "removed"
    REACTIVATED = "reactivated"


class ObjectType(StrEnum):
    ENTITY = "entity"
    FIELD = "field"
    INDEX = "index"
    RELATIONSHIP = "relationship"


@dataclass(frozen=True, slots=True)
class InspectedField:
    physical_name: str
    ordinal_position: int
    native_data_type: str
    normalized_data_type: str
    column_type: str
    is_nullable: bool
    default_value: Any
    is_primary_key: bool
    is_unique: bool
    is_auto_increment: bool
    character_maximum_length: int | None
    numeric_precision: int | None
    numeric_scale: int | None
    datetime_precision: int | None
    character_set: str | None
    collation: str | None
    comment: str | None
    extra: str | None


@dataclass(frozen=True, slots=True)
class InspectedIndexField:
    physical_name: str | None
    sequence: int
    sort_direction: str | None
    prefix_length: int | None


@dataclass(frozen=True, slots=True)
class InspectedIndex:
    physical_name: str
    index_type: str | None
    is_unique: bool
    is_primary: bool
    fields: list[InspectedIndexField] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class InspectedEntity:
    physical_name: str
    entity_type: EntityType
    schema_name: str
    comment: str | None
    estimated_rows: int | None
    storage_engine: str | None
    collation: str | None
    fields: list[InspectedField] = field(default_factory=list)
    indexes: list[InspectedIndex] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class InspectedRelationshipField:
    source_field: str
    target_field: str
    sequence: int


@dataclass(frozen=True, slots=True)
class InspectedRelationship:
    constraint_name: str
    source_entity: str
    target_entity: str
    update_rule: str | None
    delete_rule: str | None
    fields: list[InspectedRelationshipField] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class InspectedSchema:
    schema_name: str
    entities: list[InspectedEntity]
    relationships: list[InspectedRelationship]
    warnings: list[str] = field(default_factory=list)
