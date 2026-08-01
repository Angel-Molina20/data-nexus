import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from app.domain.query_model.analysis import QueryComplexity
from app.domain.query_model.ast import UniversalQuery

COMPILER_VERSION = "1.0.0"


@dataclass(frozen=True)
class CatalogEntity:
    id: uuid.UUID
    schema_name: str
    physical_name: str
    is_active: bool


@dataclass(frozen=True)
class CatalogField:
    id: uuid.UUID
    entity_id: uuid.UUID
    physical_name: str
    normalized_data_type: str
    is_active: bool


@dataclass(frozen=True)
class RelationshipPair:
    source_field_id: uuid.UUID
    target_field_id: uuid.UUID
    sequence: int


@dataclass(frozen=True)
class CatalogRelationship:
    id: uuid.UUID
    kind: Literal["physical", "semantic"]
    source_entity_id: uuid.UUID
    target_entity_id: uuid.UUID
    enabled: bool
    pairs: tuple[RelationshipPair, ...]


@dataclass(frozen=True)
class PolymorphicMappingSnapshot:
    id: uuid.UUID
    relationship_id: uuid.UUID
    type_value: str
    target_entity_id: uuid.UUID
    target_field_id: uuid.UUID
    enabled: bool


@dataclass(frozen=True)
class PolymorphicRelationshipSnapshot:
    id: uuid.UUID
    source_entity_id: uuid.UUID
    type_field_id: uuid.UUID
    id_field_id: uuid.UUID
    enabled: bool


@dataclass(frozen=True)
class CatalogSnapshot:
    entities: dict[uuid.UUID, CatalogEntity]
    fields: dict[uuid.UUID, CatalogField]
    relationships: dict[uuid.UUID, CatalogRelationship]
    polymorphic_relationships: dict[uuid.UUID, PolymorphicRelationshipSnapshot]
    polymorphic_mappings: dict[uuid.UUID, PolymorphicMappingSnapshot]


@dataclass(frozen=True)
class CompilationConnection:
    id: uuid.UUID
    engine: str
    provider: str
    raw_version: str | None
    major_version: int | None
    minor_version: int | None
    capabilities: dict[str, bool]


@dataclass(frozen=True)
class CompilationOptions:
    mode: Literal["definition", "preview"] = "definition"
    preview_values: dict[str, Any] = field(default_factory=dict)
    pretty: bool = True
    max_bound_parameters: int = 5000


@dataclass(frozen=True)
class CompilationContext:
    query: UniversalQuery
    normalized_query: dict[str, Any]
    connection: CompilationConnection
    catalog: CatalogSnapshot
    current_user_id: uuid.UUID
    options: CompilationOptions
    query_fingerprint: str
    complexity: QueryComplexity


@dataclass(frozen=True)
class ParameterMetadata:
    binding: str
    source: Literal["literal", "parameter", "internal"]
    data_type: str
    sensitive: bool
    parameter_id: str | None = None
    has_value: bool = False


@dataclass(frozen=True)
class CompilationWarning:
    code: str
    message: str


@dataclass(frozen=True)
class CompilationResult:
    success: bool
    engine: str
    provider: str
    server_version: str | None
    dialect: str
    compiler_version: str
    sql: str
    parameters: dict[str, Any]
    parameter_metadata: dict[str, ParameterMetadata]
    warnings: tuple[CompilationWarning, ...]
    errors: tuple[CompilationWarning, ...]
    capabilities_used: tuple[str, ...]
    referenced_entities: tuple[uuid.UUID, ...]
    referenced_fields: tuple[uuid.UUID, ...]
    referenced_relationships: tuple[uuid.UUID, ...]
    query_fingerprint: str
    compilation_fingerprint: str
    complexity: QueryComplexity
    executed: bool = False
