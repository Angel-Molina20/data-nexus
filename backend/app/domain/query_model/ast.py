import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

QUERY_SCHEMA_VERSION = "1.0"
Identifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z][A-Za-z0-9_]{0,63}$")]
DataType = Literal[
    "unknown",
    "null",
    "boolean",
    "integer",
    "decimal",
    "float",
    "string",
    "text",
    "date",
    "time",
    "datetime",
    "binary",
    "json",
    "uuid",
    "enum",
    "set",
    "list",
]


class QueryNode(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FieldReference(QueryNode):
    node_type: Literal["field"] = "field"
    source_id: Identifier
    field_id: uuid.UUID
    semantic_name: str | None = Field(default=None, max_length=160)


class OuterFieldReference(QueryNode):
    node_type: Literal["outer_field"] = "outer_field"
    scope_id: Identifier
    source_id: Identifier
    field_id: uuid.UUID


class LiteralNode(QueryNode):
    node_type: Literal["literal"] = "literal"
    value_type: Literal[
        "string",
        "integer",
        "decimal",
        "float",
        "boolean",
        "date",
        "time",
        "datetime",
        "null",
        "json",
    ]
    value: (
        str
        | int
        | float
        | bool
        | Decimal
        | date
        | time
        | datetime
        | list[Any]
        | dict[str, Any]
        | None
    )


class ParameterReference(QueryNode):
    node_type: Literal["parameter"] = "parameter"
    parameter_id: Identifier


class BinaryExpression(QueryNode):
    node_type: Literal["binary"] = "binary"
    operator: Literal["add", "subtract", "multiply", "divide", "modulo"]
    left: "Expression"
    right: "Expression"


class UnaryExpression(QueryNode):
    node_type: Literal["unary"] = "unary"
    operator: Literal["negate", "positive"]
    operand: "Expression"


class FunctionExpression(QueryNode):
    node_type: Literal["function"] = "function"
    function: Literal[
        "lower",
        "upper",
        "trim",
        "length",
        "substring",
        "concat",
        "replace",
        "coalesce",
        "null_if",
        "current_date",
        "current_datetime",
        "year",
        "month",
        "day",
        "date_add",
        "date_subtract",
        "date_difference",
        "absolute",
        "round",
        "floor",
        "ceiling",
        "power",
    ]
    arguments: list["Expression"] = Field(default_factory=list, max_length=20)
    options: dict[str, bool | int | str] = Field(default_factory=dict)


class AggregateExpression(QueryNode):
    node_type: Literal["aggregate"] = "aggregate"
    aggregate: Literal["count", "count_all", "sum", "average", "minimum", "maximum"]
    argument: "Expression | None" = None
    distinct: bool = False
    filter: "Predicate | None" = None

    @model_validator(mode="after")
    def validate_argument(self) -> "AggregateExpression":
        if self.aggregate == "count_all" and self.argument is not None:
            raise ValueError("count_all no acepta argumento")
        if self.aggregate != "count_all" and self.argument is None:
            raise ValueError("La agregación requiere argumento")
        return self


class CaseBranch(QueryNode):
    when: "Predicate"
    then: "Expression"


class CaseExpression(QueryNode):
    node_type: Literal["case"] = "case"
    branches: list[CaseBranch] = Field(min_length=1, max_length=50)
    else_expression: "Expression | None" = None


class CastExpression(QueryNode):
    node_type: Literal["cast"] = "cast"
    expression: "Expression"
    target_type: Literal["string", "integer", "decimal", "float", "boolean", "date", "datetime"]


class SubqueryExpression(QueryNode):
    node_type: Literal["subquery"] = "subquery"
    query_id: Identifier
    query: "QueryBody"
    correlation: list[OuterFieldReference] = Field(default_factory=list, max_length=50)


Expression = Annotated[
    FieldReference
    | OuterFieldReference
    | LiteralNode
    | ParameterReference
    | BinaryExpression
    | UnaryExpression
    | FunctionExpression
    | AggregateExpression
    | CaseExpression
    | CastExpression
    | SubqueryExpression,
    Field(discriminator="node_type"),
]


class ComparisonPredicate(QueryNode):
    node_type: Literal["comparison"] = "comparison"
    operator: Literal[
        "equals",
        "not_equals",
        "greater_than",
        "greater_than_or_equal",
        "less_than",
        "less_than_or_equal",
    ]
    left: Expression
    right: Expression


class LogicalGroupPredicate(QueryNode):
    node_type: Literal["logical_group"] = "logical_group"
    operator: Literal["and", "or"]
    conditions: list["Predicate"] = Field(min_length=1, max_length=200)


class NotPredicate(QueryNode):
    node_type: Literal["not"] = "not"
    condition: "Predicate"


class IsNullPredicate(QueryNode):
    node_type: Literal["is_null"] = "is_null"
    expression: Expression
    negated: bool = False


class BetweenPredicate(QueryNode):
    node_type: Literal["between"] = "between"
    expression: Expression
    lower: Expression
    upper: Expression
    negated: bool = False


class InPredicate(QueryNode):
    node_type: Literal["in"] = "in"
    expression: Expression
    values: list[Expression] | None = None
    subquery: SubqueryExpression | None = None
    negated: bool = False

    @model_validator(mode="after")
    def one_source(self) -> "InPredicate":
        if (self.values is None) == (self.subquery is None):
            raise ValueError("IN requiere valores o subconsulta, nunca ambos")
        if self.values == []:
            raise ValueError("IN no acepta una lista vacía")
        return self


class LikePredicate(QueryNode):
    node_type: Literal["like"] = "like"
    expression: Expression
    pattern: LiteralNode | ParameterReference
    case_sensitive: bool = True
    negated: bool = False
    escape_character: str | None = Field(default=None, min_length=1, max_length=1)


class ExistsPredicate(QueryNode):
    node_type: Literal["exists"] = "exists"
    query: SubqueryExpression
    negated: bool = False


class BooleanExpressionPredicate(QueryNode):
    node_type: Literal["boolean_expression"] = "boolean_expression"
    expression: Expression


Predicate = Annotated[
    ComparisonPredicate
    | LogicalGroupPredicate
    | NotPredicate
    | IsNullPredicate
    | BetweenPredicate
    | InPredicate
    | LikePredicate
    | ExistsPredicate
    | BooleanExpressionPredicate,
    Field(discriminator="node_type"),
]


class SourceNode(QueryNode):
    source_id: Identifier
    entity_id: uuid.UUID
    alias: Identifier
    semantic_name: str | None = Field(default=None, max_length=160)


class JoinNode(QueryNode):
    join_id: Identifier
    join_type: Literal["inner", "left", "right", "cross"]
    source: SourceNode
    relationship_id: uuid.UUID | None = None
    on: Predicate | None = None
    polymorphic_mapping_id: uuid.UUID | None = None
    options: dict[str, bool | str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def relationship_or_on(self) -> "JoinNode":
        if self.join_type != "cross" and self.relationship_id is None and self.on is None:
            raise ValueError("JOIN requiere relación o condición")
        return self


class SelectItem(QueryNode):
    select_id: Identifier
    item_type: Literal["field", "expression", "aggregate", "subquery", "literal", "parameter"]
    expression: Expression
    alias: Identifier | None = None
    label: str | None = Field(default=None, max_length=160)
    hidden: bool = False
    format: str | None = Field(default=None, max_length=80)


class GroupByItem(QueryNode):
    expression: Expression
    position: int | None = Field(default=None, ge=1)


class OrderByItem(QueryNode):
    expression: Expression
    direction: Literal["ascending", "descending"] = "ascending"
    nulls: Literal["first", "last", "engine_default"] = "engine_default"


class ParameterValidation(QueryNode):
    minimum: Decimal | None = None
    maximum: Decimal | None = None
    min_length: int | None = Field(default=None, ge=0)
    max_length: int | None = Field(default=None, ge=0)
    pattern: str | None = Field(default=None, max_length=256)
    multiple: bool = False


class QueryParameterDefinition(QueryNode):
    parameter_id: Identifier
    name: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    data_type: Literal[
        "string",
        "integer",
        "decimal",
        "float",
        "boolean",
        "date",
        "time",
        "datetime",
        "uuid",
        "enum",
        "list",
    ]
    required: bool = True
    nullable: bool = False
    default_value: Any | None = None
    allowed_values: list[str | int | float | bool] | None = Field(default=None, max_length=1000)
    validation: ParameterValidation = Field(default_factory=ParameterValidation)
    sensitive: bool = False
    display_order: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def no_sensitive_default(self) -> "QueryParameterDefinition":
        if self.sensitive and self.default_value is not None:
            raise ValueError("Un parámetro sensible no puede guardar valor predeterminado")
        return self


class QueryMetadata(QueryNode):
    name: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=50)
    created_from: Literal["api", "future_visual_builder", "import"] = "api"
    notes: str | None = Field(default=None, max_length=2000)


class QueryOptions(QueryNode):
    strict_type_validation: bool = True
    include_hidden_fields: bool = False
    allow_inactive_metadata: bool = False
    warnings_as_errors: bool = False


class UnionNode(QueryNode):
    union_id: Identifier
    operation: Literal["union", "union_all"]
    query: "QueryBody"


class QueryBody(QueryNode):
    scope_id: Identifier = "root"
    query_type: Literal["select"] = "select"
    source: SourceNode
    joins: list[JoinNode] = Field(default_factory=list)
    select: list[SelectItem] = Field(min_length=1)
    where: Predicate | None = None
    group_by: list[GroupByItem] = Field(default_factory=list)
    having: Predicate | None = None
    order_by: list[OrderByItem] = Field(default_factory=list)
    distinct: bool = False
    limit: int | None = Field(default=None, ge=0)
    offset: int | None = Field(default=None, ge=0)
    unions: list[UnionNode] = Field(default_factory=list)


class UniversalQuery(QueryNode):
    schema_version: str = QUERY_SCHEMA_VERSION
    connection_id: uuid.UUID
    query: QueryBody
    parameters: list[QueryParameterDefinition] = Field(default_factory=list)
    metadata: QueryMetadata = Field(default_factory=QueryMetadata)
    options: QueryOptions = Field(default_factory=QueryOptions)

    @model_validator(mode="after")
    def supported_version(self) -> "UniversalQuery":
        if self.schema_version != QUERY_SCHEMA_VERSION:
            raise ValueError("QUERY_SCHEMA_VERSION_UNSUPPORTED")
        return self


UniversalQuery.model_rebuild()
