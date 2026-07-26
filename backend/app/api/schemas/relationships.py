import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
RelationshipStatus = Literal["suggested", "confirmed", "rejected", "invalid", "disabled"]
Cardinality = Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many", "unknown"]


class RelationshipFieldPairRequest(BaseModel):
    source_field_id: uuid.UUID
    target_field_id: uuid.UUID


class ManualRelationshipRequest(BaseModel):
    source_entity_id: uuid.UUID
    target_entity_id: uuid.UUID
    fields: Annotated[list[RelationshipFieldPairRequest], Field(min_length=1, max_length=8)]
    name: ShortText
    display_name: ShortText
    description: Description | None = None
    cardinality: Cardinality = "many_to_one"
    is_bidirectional: bool = False
    confirm_self_relationship: bool = False


class RelationshipUpdateRequest(BaseModel):
    display_name: ShortText | None = None
    description: Description | None = None
    cardinality: Cardinality | None = None


class ConfirmCandidateRequest(RelationshipUpdateRequest):
    target_entity_id: uuid.UUID | None = None
    target_field_ids: Annotated[list[uuid.UUID] | None, Field(max_length=8)] = None


class RelationshipEndpoint(BaseModel):
    entity_id: uuid.UUID
    entity_name: str
    display_name: str
    fields: list[str]


class UnifiedRelationshipResponse(BaseModel):
    id: uuid.UUID
    type: str
    status: RelationshipStatus
    detection_source: str
    source: RelationshipEndpoint
    target: RelationshipEndpoint | None
    name: str
    display_name: str
    description: str | None
    cardinality: str
    confidence: float
    conditions: list[dict[str, Any]]
    reasons: list[str]
    warnings: list[str]
    enabled: bool
    invalid_reason: str | None
    fingerprint: str | None = None


class RelationshipListResponse(BaseModel):
    items: list[UnifiedRelationshipResponse]
    total: int
    physical: int
    confirmed: int
    suggested: int
    polymorphic: int
    invalid: int
    bridge_candidates: list[dict[str, Any]] = Field(default_factory=list)


class GraphNodeResponse(BaseModel):
    id: uuid.UUID
    physical_name: str
    display_name: str
    entity_type: str
    is_active: bool
    key_fields: list[str]
    sensitive_fields: int


class GraphEdgeResponse(BaseModel):
    id: str
    source: uuid.UUID
    target: uuid.UUID
    relationship_type: str
    status: str
    label: str


class RelationshipGraphResponse(BaseModel):
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]
    truncated: bool


class DetectionResponse(BaseModel):
    detected: int
    created: int
    preserved_rejections: int
    polymorphic_candidates: int
    bridge_candidates: list[dict[str, Any]]


class PolymorphicMappingRequest(BaseModel):
    type_value: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    target_entity_id: uuid.UUID
    target_field_id: uuid.UUID
    display_name: ShortText
    is_enabled: bool = True


class PolymorphicRelationshipRequest(BaseModel):
    source_entity_id: uuid.UUID
    type_field_id: uuid.UUID
    id_field_id: uuid.UUID
    name: ShortText
    display_name: ShortText
    description: Description | None = None
    mappings: Annotated[list[PolymorphicMappingRequest], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def distinct_fields(self) -> "PolymorphicRelationshipRequest":
        if self.type_field_id == self.id_field_id:
            raise ValueError("El discriminador y el identificador deben ser distintos.")
        return self


class PolymorphicMappingResponse(BaseModel):
    id: uuid.UUID
    type_value: str
    target_entity_id: uuid.UUID
    target_entity: str
    target_field_id: uuid.UUID
    target_field: str
    display_name: str
    is_enabled: bool
    conditions: list[str]


class PolymorphicRelationshipResponse(BaseModel):
    id: uuid.UUID
    source_entity_id: uuid.UUID
    source_entity: str
    type_field_id: uuid.UUID
    type_field: str
    id_field_id: uuid.UUID
    id_field: str
    name: str
    display_name: str
    description: str | None
    status: str
    is_enabled: bool
    invalid_reason: str | None
    mappings: list[PolymorphicMappingResponse]


SemanticType = Literal[
    "identifier",
    "foreign_identifier",
    "person_name",
    "email",
    "phone",
    "date",
    "datetime",
    "currency",
    "percentage",
    "status",
    "category",
    "description",
    "code",
    "url",
    "boolean",
    "unknown",
]


class SemanticEntityUpdateRequest(BaseModel):
    display_name: ShortText | None = None
    singular_name: ShortText | None = None
    plural_name: ShortText | None = None
    description: Description | None = None
    business_domain: ShortText | None = None
    tags: Annotated[list[ShortText], Field(max_length=20)] | None = None
    is_visible: bool | None = None


class SemanticFieldUpdateRequest(BaseModel):
    display_name: ShortText | None = None
    description: Description | None = None
    semantic_type: SemanticType | None = None
    format: Annotated[str, StringConstraints(max_length=80)] | None = None
    tags: Annotated[list[ShortText], Field(max_length=20)] | None = None
    is_visible: bool | None = None
    is_sensitive: bool | None = None


class SemanticFieldResponse(BaseModel):
    id: uuid.UUID
    physical_name: str
    display_name: str
    description: str | None
    semantic_type: str
    format: str | None
    tags: list[str]
    is_visible: bool
    is_sensitive: bool
    is_active: bool


class SemanticEntityResponse(BaseModel):
    id: uuid.UUID
    physical_name: str
    display_name: str
    singular_name: str | None
    plural_name: str | None
    description: str | None
    business_domain: str | None
    tags: list[str]
    is_visible: bool
    is_active: bool
    sensitive_fields: int
    fields: list[SemanticFieldResponse] = Field(default_factory=list)
    updated_at: datetime | None = None


class SemanticEntityListResponse(BaseModel):
    items: list[SemanticEntityResponse]
    total: int
