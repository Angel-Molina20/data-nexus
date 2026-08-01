import uuid
from dataclasses import replace

from app.domain.relationships.models import (
    Cardinality,
    CatalogEntity,
    CatalogField,
    TypeCompatibility,
)
from app.domain.relationships.rules import (
    detect_bridge_candidates,
    detect_candidates,
    infer_cardinality,
    singularize,
    stable_fingerprint,
    validate_field_types,
)


def field(
    entity_id: uuid.UUID,
    name: str,
    *,
    normalized_type: str = "integer",
    column_type: str = "bigint unsigned",
    primary: bool = False,
    unique: bool = False,
    indexed: bool = False,
) -> CatalogField:
    return CatalogField(
        id=uuid.uuid4(),
        entity_id=entity_id,
        physical_name=name,
        normalized_type=normalized_type,
        column_type=column_type,
        character_maximum_length=36 if normalized_type == "string" else None,
        numeric_precision=20 if normalized_type == "integer" else None,
        is_primary_key=primary,
        is_unique=unique,
        is_active=True,
        is_indexed=indexed,
    )


def test_singularization_is_limited_and_deterministic() -> None:
    assert singularize("students") == "student"
    assert singularize("categories") == "category"
    assert singularize("addresses") == "address"


def test_detects_student_id_to_students_id() -> None:
    connection_id = uuid.uuid4()
    students_id = uuid.uuid4()
    enrollments_id = uuid.uuid4()
    student_pk = field(students_id, "id", primary=True, unique=True)
    student_fk = field(enrollments_id, "student_id", indexed=True)
    candidates = detect_candidates(
        connection_id,
        [
            CatalogEntity(students_id, "students", "table", True, [student_pk]),
            CatalogEntity(enrollments_id, "enrollments", "table", True, [student_fk]),
        ],
        minimum_confidence=0.5,
        maximum_candidates=100,
    )
    assert len(candidates) == 1
    assert candidates[0].source_field_ids == (student_fk.id,)
    assert candidates[0].target_field_ids == (student_pk.id,)
    assert candidates[0].cardinality == Cardinality.MANY_TO_ONE
    assert candidates[0].confidence_score == 1


def test_type_compatibility_blocks_signed_mismatch() -> None:
    entity_id = uuid.uuid4()
    unsigned = field(entity_id, "left_id")
    signed = field(entity_id, "right_id", column_type="bigint")
    assert validate_field_types(unsigned, signed).status == TypeCompatibility.INCOMPATIBLE


def test_text_length_difference_is_warning() -> None:
    entity_id = uuid.uuid4()
    left = field(
        entity_id,
        "left",
        normalized_type="string",
        column_type="varchar(36)",
    )
    right = replace(
        left,
        id=uuid.uuid4(),
        physical_name="right",
        character_maximum_length=255,
    )
    assert validate_field_types(left, right).status == TypeCompatibility.COMPATIBLE_WITH_WARNING


def test_fingerprint_ignores_confidence_and_visible_names() -> None:
    connection_id = uuid.uuid4()
    source = uuid.uuid4()
    target = uuid.uuid4()
    source_field = uuid.uuid4()
    target_field = uuid.uuid4()
    first = stable_fingerprint(
        connection_id=connection_id,
        relationship_type="inferred",
        source_entity_id=source,
        source_field_ids=[source_field],
        target_entity_id=target,
        target_field_ids=[target_field],
        detection_source="naming_convention",
    )
    second = stable_fingerprint(
        connection_id=connection_id,
        relationship_type="inferred",
        source_entity_id=source,
        source_field_ids=[source_field],
        target_entity_id=target,
        target_field_ids=[target_field],
        detection_source="naming_convention",
    )
    assert first == second
    assert len(first) == 64


def test_detects_all_supported_polymorphic_pairs() -> None:
    for type_name, id_name in [
        ("class", "class_id"),
        ("owner_type", "owner_id"),
        ("imageable_type", "imageable_id"),
    ]:
        entity_id = uuid.uuid4()
        candidates = detect_candidates(
            uuid.uuid4(),
            [
                CatalogEntity(
                    entity_id,
                    "documents",
                    "table",
                    True,
                    [
                        field(
                            entity_id,
                            type_name,
                            normalized_type="string",
                            column_type="varchar(100)",
                        ),
                        field(entity_id, id_name),
                    ],
                )
            ],
            minimum_confidence=0.5,
            maximum_candidates=10,
        )
        assert len(candidates) == 1
        assert candidates[0].relationship_type == "polymorphic"
        assert len(candidates[0].source_field_ids) == 2
        assert len(candidates[0].conditions) == 2


def test_cardinality_and_bridge_candidate() -> None:
    entity_id = uuid.uuid4()
    target_id = uuid.uuid4()
    source = field(entity_id, "student_id")
    target = field(target_id, "id", primary=True, unique=True)
    assert infer_cardinality(source, target) == Cardinality.MANY_TO_ONE
    bridge = CatalogEntity(
        entity_id,
        "student_courses",
        "table",
        True,
        [source, field(entity_id, "course_id"), field(entity_id, "created_at")],
    )
    assert detect_bridge_candidates([bridge])[0]["entity_name"] == "student_courses"
