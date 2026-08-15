import type { QueryBody, QueryExpression, QueryParameter } from "../../../queries/types";
import { getFilterOperator } from "./operators";
import type { FilterDataType, FilterDraft, FilterFieldOption } from "./types";

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions -- Predicate trees use the recursive backend-validated JSON contract; every dynamic collection is guarded by node_type and Array.isArray. */

export type PredicatePath = number[];

const clone = <T>(value: T): T => structuredClone(value);

export function normalizedFilterType(value: string): FilterDataType {
  if (
    ["char", "varchar", "text", "string", "enum", "set", "uuid"].some((item) =>
      value.toLowerCase().includes(item),
    )
  )
    return "string";
  if (
    ["tinyint", "smallint", "mediumint", "bigint", "integer", "int"].includes(value.toLowerCase())
  )
    return "integer";
  if (["decimal", "numeric", "float", "double", "real"].includes(value.toLowerCase()))
    return "decimal";
  if (value.toLowerCase() === "boolean" || value.toLowerCase() === "bool") return "boolean";
  if (value.toLowerCase() === "date") return "date";
  if (["datetime", "timestamp"].includes(value.toLowerCase())) return "datetime";
  if (value.toLowerCase() === "time") return "time";
  if (value.toLowerCase() === "json") return "json";
  if (["binary", "blob", "varbinary"].some((item) => value.toLowerCase().includes(item)))
    return "binary";
  return "unknown";
}

function literal(value: string, type: FilterDataType): QueryExpression {
  if (type === "boolean")
    return { node_type: "literal", value_type: "boolean", value: value === "true" };
  if (type === "integer")
    return { node_type: "literal", value_type: "integer", value: Number.parseInt(value, 10) };
  if (type === "decimal") return { node_type: "literal", value_type: "decimal", value };
  if (["date", "datetime", "time"].includes(type))
    return { node_type: "literal", value_type: type, value };
  if (type === "json")
    return { node_type: "literal", value_type: "json", value: JSON.parse(value) as unknown };
  return { node_type: "literal", value_type: "string", value };
}

function valueExpressions(
  draft: FilterDraft,
  field: FilterFieldOption,
  fields: FilterFieldOption[],
): QueryExpression[] {
  if (draft.valueSource === "parameter")
    return [{ node_type: "parameter", parameter_id: draft.parameterId }];
  if (draft.valueSource === "field") {
    const selected = fields.find((item) => item.id === draft.rightFieldKey);
    return selected ? [clone(selected.expression)] : [];
  }
  return draft.values
    .filter((value) => value.trim() !== "")
    .map((value) => literal(value, field.dataType));
}

export function buildPredicate(
  draft: FilterDraft,
  fields: FilterFieldOption[],
): QueryExpression | null {
  const field = fields.find((item) => item.id === draft.fieldKey);
  const operator = getFilterOperator(draft.operatorId);
  if (!field || !operator) return null;
  if (operator.cardinality === "none")
    return {
      node_type: "is_null",
      expression: clone(field.expression),
      negated: Boolean(operator.negated),
    };
  const values = valueExpressions(draft, field, fields);
  if (
    (operator.cardinality === "one" && values.length !== 1) ||
    (operator.cardinality === "two" && values.length !== 2) ||
    (operator.cardinality === "many" && values.length < 1)
  )
    return null;
  if (operator.nodeType === "comparison")
    return {
      node_type: "comparison",
      operator: operator.astOperator,
      left: clone(field.expression),
      right: values[0],
    };
  if (operator.nodeType === "between")
    return {
      node_type: "between",
      expression: clone(field.expression),
      lower: values[0],
      upper: values[1],
      negated: Boolean(operator.negated),
    };
  if (operator.nodeType === "in")
    return {
      node_type: "in",
      expression: clone(field.expression),
      values,
      subquery: null,
      negated: Boolean(operator.negated),
    };
  if (operator.nodeType === "like") {
    const pattern = clone(values[0]!);
    if (pattern.node_type === "literal" && typeof pattern.value === "string") {
      if (operator.likeAffix === "contains") pattern.value = `%${pattern.value}%`;
      if (operator.likeAffix === "starts") pattern.value = `${pattern.value}%`;
      if (operator.likeAffix === "ends") pattern.value = `%${pattern.value}`;
    }
    return {
      node_type: "like",
      expression: clone(field.expression),
      pattern,
      case_sensitive: true,
      negated: Boolean(operator.negated),
      escape_character: null,
    };
  }
  return null;
}

export type SubqueryFilterKind = "in" | "not_in" | "exists" | "not_exists";

export function buildSubqueryPredicate({
  kind,
  field,
  query,
  queryId,
  outerField,
  innerField,
  outerScopeId,
  additionalPredicates = [],
}: {
  kind: SubqueryFilterKind;
  field?: FilterFieldOption;
  query: QueryBody;
  queryId: string;
  outerField?: FilterFieldOption;
  innerField?: QueryExpression;
  outerScopeId: string;
  additionalPredicates?: QueryExpression[];
}): QueryExpression | null {
  if ((kind === "in" || kind === "not_in") && !field) return null;
  const nestedQuery = clone(query);
  for (const predicate of additionalPredicates)
    nestedQuery.where = appendPredicate(nestedQuery.where, clone(predicate));
  const correlation =
    outerField && innerField
      ? {
          node_type: "outer_field",
          scope_id: outerScopeId,
          source_id: outerField.sourceId,
          field_id: outerField.fieldId,
        }
      : null;
  if (correlation) {
    const currentWhere = nestedQuery.where;
    nestedQuery.where = appendPredicate(currentWhere, {
      node_type: "comparison",
      operator: "equals",
      left: clone(innerField),
      right: correlation,
    });
  }
  const subquery: QueryExpression = {
    node_type: "subquery",
    query_id: queryId,
    query: nestedQuery,
    correlation: correlation ? [correlation] : [],
  };
  if (kind === "exists" || kind === "not_exists")
    return { node_type: "exists", query: subquery, negated: kind === "not_exists" };
  return {
    node_type: "in",
    expression: clone(field!.expression),
    values: null,
    subquery,
    negated: kind === "not_in",
  };
}

export function appendPredicate(
  root: QueryExpression | null | undefined,
  predicate: QueryExpression,
): QueryExpression {
  if (!root) return predicate;
  if (
    root.node_type === "logical_group" &&
    root.operator === "and" &&
    Array.isArray(root.conditions)
  )
    return { ...clone(root), conditions: [...root.conditions, predicate] };
  return { node_type: "logical_group", operator: "and", conditions: [clone(root), predicate] };
}

export function appendGroup(root: QueryExpression | null | undefined): QueryExpression {
  const group = { node_type: "logical_group", operator: "and", conditions: [] } as QueryExpression;
  if (!root) return group;
  if (root.node_type === "logical_group" && Array.isArray(root.conditions))
    return { ...clone(root), conditions: [...root.conditions, group] };
  return { node_type: "logical_group", operator: "and", conditions: [clone(root), group] };
}

export function updatePredicateAt(
  root: QueryExpression,
  path: PredicatePath,
  update: (node: QueryExpression) => QueryExpression | null,
): QueryExpression | null {
  if (!path.length) return update(clone(root));
  if (root.node_type !== "logical_group" || !Array.isArray(root.conditions)) return root;
  const [index, ...rest] = path;
  const conditions = [...root.conditions] as QueryExpression[];
  const child = conditions[index!];
  if (!child) return root;
  const next = updatePredicateAt(child, rest, update);
  if (next) conditions[index!] = next;
  else conditions.splice(index!, 1);
  if (!conditions.length) return null;
  return { ...clone(root), conditions };
}

export function reorderPredicate(
  root: QueryExpression,
  path: PredicatePath,
  direction: -1 | 1,
): QueryExpression {
  if (!path.length) return root;
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updatePredicateAt(root, parentPath, (parent) => {
    if (parent.node_type !== "logical_group" || !Array.isArray(parent.conditions)) return parent;
    const target = index + direction;
    if (target < 0 || target >= parent.conditions.length) return parent;
    const conditions = [...parent.conditions] as QueryExpression[];
    [conditions[index], conditions[target]] = [conditions[target]!, conditions[index]!];
    return { ...parent, conditions };
  })!;
}

export function duplicatePredicate(root: QueryExpression, path: PredicatePath): QueryExpression {
  if (!path.length)
    return { node_type: "logical_group", operator: "and", conditions: [clone(root), clone(root)] };
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updatePredicateAt(root, parentPath, (parent) => {
    if (parent.node_type !== "logical_group" || !Array.isArray(parent.conditions)) return parent;
    const conditions = [...parent.conditions] as QueryExpression[];
    const current = conditions[index];
    if (current) conditions.splice(index + 1, 0, clone(current));
    return { ...parent, conditions };
  })!;
}

export function predicateCount(node: QueryExpression): number {
  if (node.node_type !== "logical_group" || !Array.isArray(node.conditions)) return 1;
  return node.conditions.reduce(
    (total: number, child) => total + predicateCount(child as QueryExpression),
    0,
  );
}

export function compatibleParameters(parameters: QueryParameter[], type: FilterDataType) {
  return parameters.filter(
    (parameter) =>
      normalizedFilterType(parameter.data_type) === type ||
      type === "unknown" ||
      normalizedFilterType(parameter.data_type) === "unknown",
  );
}
