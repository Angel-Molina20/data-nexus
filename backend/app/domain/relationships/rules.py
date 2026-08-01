import hashlib
import json
import re
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from app.domain.relationships.models import (
    Cardinality,
    CatalogEntity,
    CatalogField,
    CompatibilityResult,
    DetectionSource,
    RelationshipCandidate,
    RelationshipType,
    TypeCompatibility,
)

POLYMORPHIC_PAIRS = (
    ("class", "class_id"),
    ("type", "type_id"),
    ("owner_type", "owner_id"),
    ("entity_type", "entity_id"),
    ("object_type", "object_id"),
    ("reference_type", "reference_id"),
    ("related_type", "related_id"),
)
NUMERIC_TYPES = {"integer", "decimal", "float"}
STRING_TYPES = {"string", "text", "uuid", "enum"}


def singularize(value: str) -> str:
    lowered = value.casefold()
    if lowered.endswith("ies") and len(lowered) > 3:
        return lowered[:-3] + "y"
    if lowered.endswith(("ses", "xes", "zes", "ches", "shes")):
        return lowered[:-2]
    if lowered.endswith("s") and not lowered.endswith("ss"):
        return lowered[:-1]
    return lowered


def stable_fingerprint(
    *,
    connection_id: UUID,
    relationship_type: str,
    source_entity_id: UUID,
    source_field_ids: Iterable[UUID],
    target_entity_id: UUID | None,
    target_field_ids: Iterable[UUID],
    detection_source: str,
    conditions: Iterable[dict[str, str]] = (),
) -> str:
    payload = {
        "connection_id": str(connection_id),
        "relationship_type": relationship_type,
        "source_entity_id": str(source_entity_id),
        "source_field_ids": [str(item) for item in source_field_ids],
        "target_entity_id": str(target_entity_id) if target_entity_id else None,
        "target_field_ids": [str(item) for item in target_field_ids],
        "detection_source": detection_source,
        "conditions": list(conditions),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def validate_field_types(source: CatalogField, target: CatalogField) -> CompatibilityResult:
    if source.normalized_type == target.normalized_type:
        if source.normalized_type == "integer":
            source_unsigned = "unsigned" in source.column_type.casefold()
            target_unsigned = "unsigned" in target.column_type.casefold()
            if source_unsigned != target_unsigned:
                return CompatibilityResult(
                    TypeCompatibility.INCOMPATIBLE,
                    ("Los enteros no comparten signed/unsigned.",),
                )
            if source.numeric_precision != target.numeric_precision:
                return CompatibilityResult(
                    TypeCompatibility.COMPATIBLE_WITH_WARNING,
                    ("La precisión numérica es diferente.",),
                )
        if source.normalized_type in STRING_TYPES:
            left = source.character_maximum_length
            right = target.character_maximum_length
            if left and right and left != right:
                return CompatibilityResult(
                    TypeCompatibility.COMPATIBLE_WITH_WARNING,
                    ("La longitud de los campos es diferente.",),
                )
        return CompatibilityResult(TypeCompatibility.COMPATIBLE)
    if {source.normalized_type, target.normalized_type} <= STRING_TYPES:
        return CompatibilityResult(
            TypeCompatibility.COMPATIBLE_WITH_WARNING,
            ("Los tipos de texto son compatibles con diferencias de representación.",),
        )
    if source.normalized_type in NUMERIC_TYPES and target.normalized_type in NUMERIC_TYPES:
        return CompatibilityResult(
            TypeCompatibility.COMPATIBLE_WITH_WARNING,
            ("Los tipos numéricos requieren revisar precisión y signo.",),
        )
    return CompatibilityResult(
        TypeCompatibility.INCOMPATIBLE,
        ("Los tipos físicos no son compatibles.",),
    )


def infer_cardinality(source: CatalogField, target: CatalogField) -> Cardinality:
    if source.is_unique and (target.is_primary_key or target.is_unique):
        return Cardinality.ONE_TO_ONE
    if target.is_primary_key or target.is_unique:
        return Cardinality.MANY_TO_ONE
    return Cardinality.UNKNOWN


def detect_candidates(
    connection_id: UUID,
    entities: list[CatalogEntity],
    *,
    minimum_confidence: float,
    maximum_candidates: int,
) -> list[RelationshipCandidate]:
    active = [item for item in entities if item.is_active]
    by_singular: dict[str, list[CatalogEntity]] = {}
    for entity in active:
        by_singular.setdefault(singularize(entity.physical_name), []).append(entity)
    candidates: list[RelationshipCandidate] = []
    for entity in active:
        names = {item.physical_name.casefold(): item for item in entity.fields if item.is_active}
        candidates.extend(_detect_polymorphic(connection_id, entity, names, minimum_confidence))
        for source in entity.fields:
            if not source.is_active or not source.physical_name.casefold().endswith("_id"):
                continue
            if any(source.id in item.source_field_ids for item in candidates):
                continue
            stem = source.physical_name.casefold()[:-3]
            targets = by_singular.get(stem, [])
            for target_entity in targets:
                if target_entity.id == entity.id:
                    continue
                target_fields = [
                    item
                    for item in target_entity.fields
                    if item.is_active and item.physical_name.casefold() == "id"
                ]
                if not target_fields:
                    continue
                target = target_fields[0]
                compatibility = validate_field_types(source, target)
                if compatibility.status == TypeCompatibility.INCOMPATIBLE:
                    continue
                score = 0.55
                reasons = ["El campo sigue la convención singular_id."]
                if target.is_primary_key or target.is_unique:
                    score += 0.2
                    reasons.append("El campo destino es clave primaria o único.")
                if source.is_indexed:
                    score += 0.1
                    reasons.append("El campo origen está indexado.")
                if compatibility.status == TypeCompatibility.COMPATIBLE:
                    score += 0.15
                    reasons.append("Los tipos son compatibles.")
                else:
                    score += 0.05
                if len(targets) > 1:
                    score -= 0.15
                score = round(max(0.0, min(score, 1.0)), 2)
                if score < minimum_confidence:
                    continue
                fingerprint = stable_fingerprint(
                    connection_id=connection_id,
                    relationship_type=RelationshipType.INFERRED,
                    source_entity_id=entity.id,
                    source_field_ids=(source.id,),
                    target_entity_id=target_entity.id,
                    target_field_ids=(target.id,),
                    detection_source=DetectionSource.NAMING_CONVENTION,
                )
                candidates.append(
                    RelationshipCandidate(
                        relationship_type=RelationshipType.INFERRED,
                        detection_source=DetectionSource.NAMING_CONVENTION,
                        source_entity_id=entity.id,
                        target_entity_id=target_entity.id,
                        source_field_ids=(source.id,),
                        target_field_ids=(target.id,),
                        cardinality=infer_cardinality(source, target),
                        confidence_score=score,
                        fingerprint=fingerprint,
                        reasons=tuple(reasons),
                        warnings=compatibility.warnings,
                    )
                )
    candidates.sort(key=lambda item: (-item.confidence_score, item.fingerprint))
    return candidates[:maximum_candidates]


def _detect_polymorphic(
    connection_id: UUID,
    entity: CatalogEntity,
    fields: dict[str, CatalogField],
    minimum_confidence: float,
) -> list[RelationshipCandidate]:
    pairs = list(POLYMORPHIC_PAIRS)
    for name in fields:
        match = re.fullmatch(r"(.+)_type", name)
        if match:
            pairs.append((name, f"{match.group(1)}_id"))
    unique_pairs = list(dict.fromkeys(pairs))
    candidates = []
    for type_name, id_name in unique_pairs:
        type_field = fields.get(type_name)
        id_field = fields.get(id_name)
        if type_field is None or id_field is None:
            continue
        score = 0.9 if type_name == "class" else 0.85
        if score < minimum_confidence:
            continue
        conditions = (
            {"kind": "discriminator", "field_id": str(type_field.id)},
            {"kind": "identifier", "field_id": str(id_field.id)},
        )
        candidates.append(
            RelationshipCandidate(
                relationship_type=RelationshipType.POLYMORPHIC,
                detection_source=DetectionSource.POLYMORPHIC_PAIR,
                source_entity_id=entity.id,
                target_entity_id=None,
                source_field_ids=(type_field.id, id_field.id),
                target_field_ids=(),
                cardinality=Cardinality.MANY_TO_ONE,
                confidence_score=score,
                fingerprint=stable_fingerprint(
                    connection_id=connection_id,
                    relationship_type=RelationshipType.POLYMORPHIC,
                    source_entity_id=entity.id,
                    source_field_ids=(type_field.id, id_field.id),
                    target_entity_id=None,
                    target_field_ids=(),
                    detection_source=DetectionSource.POLYMORPHIC_PAIR,
                    conditions=conditions,
                ),
                reasons=("Se detectó un par discriminador + identificador.",),
                warnings=("Los mappings deben ser configurados por un administrador.",),
                conditions=conditions,
            )
        )
    return candidates


def detect_bridge_candidates(entities: list[CatalogEntity]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for entity in entities:
        references = [field for field in entity.fields if field.physical_name.endswith("_id")]
        if len(references) < 2:
            continue
        additional = len(entity.fields) - len(references)
        if additional <= 3:
            result.append(
                {
                    "entity_id": str(entity.id),
                    "entity_name": entity.physical_name,
                    "reference_fields": [item.physical_name for item in references],
                    "message": "Posible tabla puente para una relación muchos a muchos.",
                }
            )
    return result
