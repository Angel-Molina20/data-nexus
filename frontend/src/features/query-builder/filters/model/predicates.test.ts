import { describe, expect, it } from "vitest";

import type { QueryExpression } from "../../../queries/types";
import { operatorsForType } from "./operators";
import {
  appendPredicate,
  buildPredicate,
  buildSubqueryPredicate,
  duplicatePredicate,
  reorderPredicate,
  updatePredicateAt,
} from "./predicates";
import type { FilterDraft, FilterFieldOption } from "./types";

/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixtures assert successful predicate construction before tree operations. */

const fields: FilterFieldOption[] = [
  {
    id: "status",
    sourceId: "people",
    fieldId: "status-id",
    label: "persona.estado",
    searchText: "persona estado",
    dataType: "string",
    expression: { node_type: "field", source_id: "people", field_id: "status-id" },
    aggregate: false,
    available: true,
  },
  {
    id: "age",
    sourceId: "people",
    fieldId: "age-id",
    label: "persona.edad",
    searchText: "persona edad",
    dataType: "integer",
    expression: { node_type: "field", source_id: "people", field_id: "age-id" },
    aggregate: false,
    available: true,
  },
];

const draft = (values: Partial<FilterDraft>): FilterDraft => ({
  fieldKey: "status",
  operatorId: "equals",
  valueSource: "literal",
  values: ["activo"],
  parameterId: "",
  rightFieldKey: "",
  ...values,
});

describe("filter predicate model", () => {
  it("centralizes operators by field type", () => {
    expect(operatorsForType("string").map((item) => item.id)).toContain("contains");
    expect(operatorsForType("integer").map((item) => item.id)).toContain("greater_than");
    expect(operatorsForType("boolean").map((item) => item.id)).not.toContain("between");
  });

  it("builds literal, parameter and field comparisons", () => {
    expect(buildPredicate(draft({}), fields)).toMatchObject({
      node_type: "comparison",
      operator: "equals",
      right: { node_type: "literal", value: "activo" },
    });
    expect(
      buildPredicate(draft({ valueSource: "parameter", parameterId: "status_param" }), fields),
    ).toMatchObject({ right: { node_type: "parameter", parameter_id: "status_param" } });
    expect(
      buildPredicate(
        draft({ fieldKey: "age", valueSource: "field", rightFieldKey: "age" }),
        fields,
      ),
    ).toMatchObject({ right: { node_type: "field", field_id: "age-id" } });
  });

  it("builds NULL without a value, BETWEEN and non-empty IN", () => {
    expect(buildPredicate(draft({ operatorId: "is_null", values: [] }), fields)).toEqual({
      node_type: "is_null",
      expression: fields[0]?.expression,
      negated: false,
    });
    expect(
      buildPredicate(
        draft({ fieldKey: "age", operatorId: "between", values: ["18", "65"] }),
        fields,
      ),
    ).toMatchObject({ node_type: "between", lower: { value: 18 }, upper: { value: 65 } });
    expect(buildPredicate(draft({ operatorId: "in", values: [] }), fields)).toBeNull();
    expect(
      buildPredicate(draft({ operatorId: "in", values: ["activo", "pendiente"] }), fields),
    ).toMatchObject({
      node_type: "in",
      values: [{ value: "activo" }, { value: "pendiente" }],
    });
  });

  it("preserves nested group semantics through duplicate, reorder and delete", () => {
    const first = buildPredicate(draft({}), fields)!;
    const second = buildPredicate(
      draft({ fieldKey: "age", operatorId: "greater_than", values: ["18"] }),
      fields,
    )!;
    const root = appendPredicate(first, second);
    const duplicated = duplicatePredicate(root, [0]);
    expect(duplicated.conditions).toHaveLength(3);
    const reordered = reorderPredicate(duplicated, [2], -1);
    expect((reordered.conditions as QueryExpression[])[1]?.node_type).toBe("comparison");
    const removed = updatePredicateAt(reordered, [0], () => null);
    expect(removed?.conditions).toHaveLength(2);
  });

  it("does not mutate an advanced legacy condition during round-trip", () => {
    const legacy: QueryExpression = {
      node_type: "exists",
      negated: false,
      query: { node_type: "subquery", query_id: "legacy", query: { scope_id: "child" } },
    };
    const before = JSON.stringify(legacy);
    const wrapped = appendPredicate(legacy, buildPredicate(draft({}), fields)!);
    expect((wrapped.conditions as QueryExpression[])[0]).toEqual(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("builds IN and correlated EXISTS subqueries without SQL", () => {
    const query = {
      scope_id: "child",
      query_type: "select" as const,
      source: { source_id: "child_people", entity_id: "entity", alias: "persona" },
      joins: [],
      select: [
        {
          select_id: "child_status",
          item_type: "field",
          expression: {
            node_type: "field",
            source_id: "child_people",
            field_id: "status-id",
          },
        },
      ],
      group_by: [],
      order_by: [],
      distinct: false,
      unions: [],
    };
    expect(
      buildSubqueryPredicate({
        kind: "not_in",
        field: fields[0],
        query,
        queryId: "status_query",
        outerScopeId: "root",
      }),
    ).toMatchObject({
      node_type: "in",
      negated: true,
      values: null,
      subquery: { node_type: "subquery", query_id: "status_query" },
    });

    const correlated = buildSubqueryPredicate({
      kind: "exists",
      query,
      queryId: "exists_query",
      outerField: fields[1],
      innerField: query.select[0]?.expression,
      outerScopeId: "root",
    });
    expect(correlated).toMatchObject({
      node_type: "exists",
      negated: false,
      query: {
        correlation: [{ node_type: "outer_field", scope_id: "root", field_id: "age-id" }],
        query: {
          where: {
            node_type: "comparison",
            right: { node_type: "outer_field", scope_id: "root", field_id: "age-id" },
          },
        },
      },
    });
    expect(query).not.toHaveProperty("where");
  });

  it("combines additional subquery filters with its existing WHERE using AND", () => {
    const query = {
      scope_id: "child",
      query_type: "select" as const,
      source: { source_id: "child_people", entity_id: "entity", alias: "persona" },
      joins: [],
      select: [
        {
          select_id: "child_status",
          item_type: "field",
          expression: {
            node_type: "field",
            source_id: "child_people",
            field_id: "status-id",
          },
        },
      ],
      where: {
        node_type: "is_null",
        expression: { node_type: "field", source_id: "child_people", field_id: "deleted_at" },
        negated: false,
      },
      group_by: [],
      order_by: [],
      distinct: false,
      unions: [],
    };
    const result = buildSubqueryPredicate({
      kind: "exists",
      query,
      queryId: "filtered_query",
      outerScopeId: "root",
      additionalPredicates: [
        {
          node_type: "comparison",
          operator: "equals",
          left: { node_type: "field", source_id: "child_people", field_id: "status-id" },
          right: { node_type: "literal", value_type: "string", value: "activo" },
        },
      ],
    });
    expect(result).toMatchObject({
      query: {
        query: {
          where: {
            node_type: "logical_group",
            operator: "and",
            conditions: [{ node_type: "is_null" }, { node_type: "comparison" }],
          },
        },
      },
    });
    expect(query.where.node_type).toBe("is_null");
  });
});
