from typing import Any

from app.db.models.schema import SchemaEntity, SchemaField
from app.domain.schema.models import (
    InspectedEntity,
    InspectedField,
    InspectedIndex,
    InspectedRelationship,
)

FIELD_SNAPSHOT_ATTRIBUTES = (
    "ordinal_position",
    "native_data_type",
    "normalized_data_type",
    "column_type",
    "is_nullable",
    "default_value",
    "is_primary_key",
    "is_unique",
    "is_auto_increment",
    "character_maximum_length",
    "numeric_precision",
    "numeric_scale",
    "datetime_precision",
    "character_set",
    "collation",
    "comment",
    "extra",
)


def entity_snapshot(source: InspectedEntity) -> dict[str, Any]:
    return {
        "entity_type": source.entity_type,
        "comment": source.comment,
        "storage_engine": source.storage_engine,
        "collation": source.collation,
    }


def entity_model_snapshot(model: SchemaEntity) -> dict[str, Any]:
    return {
        "entity_type": model.entity_type,
        "comment": model.comment,
        "storage_engine": model.storage_engine,
        "collation": model.collation,
    }


def assign_entity(model: SchemaEntity, source: InspectedEntity) -> None:
    model.entity_type = source.entity_type
    model.comment = source.comment
    model.estimated_rows = source.estimated_rows
    model.storage_engine = source.storage_engine
    model.collation = source.collation


def field_snapshot(source: InspectedField) -> dict[str, Any]:
    return {name: getattr(source, name) for name in FIELD_SNAPSHOT_ATTRIBUTES}


def field_model_snapshot(model: SchemaField) -> dict[str, Any]:
    return {name: getattr(model, name) for name in FIELD_SNAPSHOT_ATTRIBUTES}


def index_snapshot(source: InspectedIndex) -> dict[str, Any]:
    return {
        "index_type": source.index_type,
        "is_unique": source.is_unique,
        "is_primary": source.is_primary,
        "fields": [
            [item.physical_name, item.sequence, item.sort_direction, item.prefix_length]
            for item in source.fields
        ],
    }


def relationship_snapshot(source: InspectedRelationship) -> dict[str, Any]:
    return {
        "update_rule": source.update_rule,
        "delete_rule": source.delete_rule,
        "fields": [[item.source_field, item.target_field, item.sequence] for item in source.fields],
    }
