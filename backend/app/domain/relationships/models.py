from dataclasses import dataclass, field
from enum import StrEnum
from uuid import UUID


class RelationshipType(StrEnum):
    PHYSICAL = "physical"
    INFERRED = "inferred"
    MANUAL = "manual"
    POLYMORPHIC = "polymorphic"


class RelationshipStatus(StrEnum):
    SUGGESTED = "suggested"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    INVALID = "invalid"
    DISABLED = "disabled"


class DetectionSource(StrEnum):
    FOREIGN_KEY = "foreign_key"
    NAMING_CONVENTION = "naming_convention"
    MATCHING_PRIMARY_KEY = "matching_primary_key"
    POLYMORPHIC_PAIR = "polymorphic_pair"
    ADMINISTRATOR = "administrator"


class Cardinality(StrEnum):
    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_ONE = "many_to_one"
    MANY_TO_MANY = "many_to_many"
    UNKNOWN = "unknown"


class TypeCompatibility(StrEnum):
    COMPATIBLE = "compatible"
    COMPATIBLE_WITH_WARNING = "compatible_with_warning"
    INCOMPATIBLE = "incompatible"


@dataclass(frozen=True, slots=True)
class CatalogField:
    id: UUID
    entity_id: UUID
    physical_name: str
    normalized_type: str
    column_type: str
    character_maximum_length: int | None
    numeric_precision: int | None
    is_primary_key: bool
    is_unique: bool
    is_active: bool
    is_indexed: bool = False


@dataclass(frozen=True, slots=True)
class CatalogEntity:
    id: UUID
    physical_name: str
    entity_type: str
    is_active: bool
    fields: list[CatalogField] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class RelationshipCandidate:
    relationship_type: RelationshipType
    detection_source: DetectionSource
    source_entity_id: UUID
    target_entity_id: UUID | None
    source_field_ids: tuple[UUID, ...]
    target_field_ids: tuple[UUID, ...]
    cardinality: Cardinality
    confidence_score: float
    fingerprint: str
    reasons: tuple[str, ...]
    warnings: tuple[str, ...]
    conditions: tuple[dict[str, str], ...] = ()


@dataclass(frozen=True, slots=True)
class CompatibilityResult:
    status: TypeCompatibility
    warnings: tuple[str, ...] = ()
