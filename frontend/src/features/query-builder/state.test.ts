import { describe, expect, it } from "vitest";

import type { QueryDocument, SavedQuery } from "../queries/types";
import { builderReducer, createBuilderState, localIssues, queryActions } from "./state";

const document = (): QueryDocument => ({
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "src_main", entity_id: "entity", alias: "main" },
    joins: [],
    select: [
      {
        select_id: "literal",
        item_type: "literal",
        expression: { node_type: "literal", value_type: "integer", value: 1 },
      },
    ],
    group_by: [],
    order_by: [],
    distinct: false,
    unions: [],
  },
  parameters: [],
  metadata: {},
  options: {},
});
const saved = (): SavedQuery => ({
  id: "query",
  name: "Consulta",
  description: null,
  connection_id: "connection",
  owner_user_id: "user",
  document: document(),
  schema_version: "1.0",
  status: "draft",
  validation_status: "not_validated",
  validation_errors: [],
  validation_warnings: [],
  fingerprint: null,
  complexity: null,
  revision: 1,
  last_validated_at: null,
  created_at: "2026-08-01",
  updated_at: "2026-08-01",
});

describe("query builder state", () => {
  it("adds fields immutably and supports undo/redo", () => {
    const initial = createBuilderState(saved(), false);
    const changed = queryActions.addField(initial.workingQuery, "src_main", "field", "Nombre");
    expect(initial.workingQuery.query.select).toHaveLength(1);
    const edited = builderReducer(initial, { type: "replace", document: changed });
    expect(edited.dirty).toBe(true);
    expect(edited.workingQuery.query.select).toHaveLength(2);
    const undone = builderReducer(edited, { type: "undo" });
    expect(undone.workingQuery.query.select).toHaveLength(1);
    const redone = builderReducer(undone, { type: "redo" });
    expect(redone.workingQuery.query.select).toHaveLength(2);
  });

  it("selects and deselects many fields as one undoable AST change", () => {
    const initial = createBuilderState(saved(), false);
    const selected = queryActions.setFields(
      initial.workingQuery,
      "src_main",
      [
        { id: "first_name", label: "Nombre" },
        { id: "email", label: "Correo" },
      ],
      true,
    );
    const edited = builderReducer(initial, { type: "replace", document: selected });
    expect(edited.workingQuery.query.select).toHaveLength(3);
    expect(edited.history).toHaveLength(1);
    const cleared = builderReducer(edited, {
      type: "replace",
      document: queryActions.setFields(
        edited.workingQuery,
        "src_main",
        [{ id: "email", label: "Correo" }],
        false,
      ),
    });
    expect(cleared.workingQuery.query.select.some((item) => item.label === "Correo")).toBe(false);
    expect(builderReducer(cleared, { type: "undo" }).workingQuery.query.select).toHaveLength(3);
  });

  it("keeps read-only mode immutable and validates duplicate aliases", () => {
    const initial = createBuilderState(saved(), true);
    const changed = queryActions.setBodyValue(initial.workingQuery, { distinct: true });
    expect(builderReducer(initial, { type: "replace", document: changed })).toBe(initial);
    const joined = queryActions.addJoin(document(), {
      join_id: "join",
      join_type: "cross",
      source: { source_id: "src_two", entity_id: "other", alias: "main" },
      options: {},
    });
    expect(localIssues(joined).some((issue) => issue.code === "QUERY_SOURCE_ALIAS_DUPLICATE")).toBe(
      true,
    );
  });

  it("stores layout apart from semantic query operations", () => {
    const next = queryActions.update(document(), (draft) => {
      draft.metadata.builder_layout = {
        nodes: { src_main: { x: 120, y: 80, collapsed: false } },
        panels: { catalog_width: 280, inspector_width: 360 },
      };
    });
    expect(next.metadata.builder_layout?.nodes.src_main?.x).toBe(120);
  });

  it("removes a join and its dependent selected fields", () => {
    let next = queryActions.addJoin(document(), {
      join_id: "join_students",
      join_type: "left",
      source: { source_id: "src_students", entity_id: "students", alias: "students" },
      relationship_id: "relationship",
      options: {},
    });
    next = queryActions.addField(next, "src_students", "student_name", "Estudiante");
    expect(next.query.select).toHaveLength(2);
    const removed = queryActions.removeJoin(next, "join_students");
    expect(removed.query.joins).toHaveLength(0);
    expect(removed.query.select).toHaveLength(1);
  });

  it("tracks a complete filter edit as one dirty and undoable AST change", () => {
    const initial = createBuilderState(saved(), false);
    const filtered = queryActions.setPredicate(initial.workingQuery, "where", {
      node_type: "comparison",
      operator: "equals",
      left: { node_type: "field", source_id: "src_main", field_id: "status" },
      right: { node_type: "literal", value_type: "string", value: "activo" },
    });
    const edited = builderReducer(initial, { type: "replace", document: filtered });
    expect(edited.dirty).toBe(true);
    expect(edited.history).toHaveLength(1);
    expect(edited.workingQuery.query.where?.node_type).toBe("comparison");
    const undone = builderReducer(edited, { type: "undo" });
    expect(undone.workingQuery.query.where).toBeUndefined();
    expect(builderReducer(undone, { type: "redo" }).workingQuery.query.where).toEqual(
      filtered.query.where,
    );
  });

  it("removes orders, parameters and UNION branches without mutating the source AST", () => {
    const source = document();
    source.query.order_by = [
      {
        expression: { node_type: "field", source_id: "src_main", field_id: "name" },
        direction: "ascending",
        nulls: "engine_default",
      },
    ];
    source.parameters = [
      {
        parameter_id: "search",
        name: "search",
        label: "Búsqueda",
        data_type: "string",
        required: false,
        nullable: true,
        validation: {},
        sensitive: false,
        display_order: 0,
      },
    ];
    source.query.unions = [
      {
        union_id: "union_1",
        operation: "union",
        query: structuredClone(source.query),
      },
    ];
    const noOrder = queryActions.removeOrderBy(source, 0);
    const noParameter = queryActions.removeParameter(noOrder, "search");
    const cleared = queryActions.removeUnion(noParameter, "union_1");
    expect(cleared.query.order_by).toEqual([]);
    expect(cleared.parameters).toEqual([]);
    expect(cleared.query.unions).toEqual([]);
    expect(source.query.order_by).toHaveLength(1);
    expect(source.parameters).toHaveLength(1);
    expect(source.query.unions).toHaveLength(1);
  });

  it("reports selected fields missing from GROUP BY and groups them in one AST action", () => {
    let grouped = queryActions.addField(document(), "src_main", "name", "Nombre");
    grouped = queryActions.update(grouped, (draft) => {
      draft.query.select.push({
        select_id: "count",
        item_type: "aggregate",
        expression: { node_type: "aggregate", aggregate: "count_all", argument: null },
        label: "Total",
      });
    });
    const issues = localIssues(grouped).filter((issue) => issue.code === "QUERY_GROUPING_INVALID");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("main.Nombre");
    const fixed = queryActions.addSelectedFieldsToGroupBy(grouped);
    expect(fixed.query.group_by).toHaveLength(1);
    expect(localIssues(fixed).some((issue) => issue.code === "QUERY_GROUPING_INVALID")).toBe(false);
    expect(queryActions.addSelectedFieldsToGroupBy(fixed).query.group_by).toHaveLength(1);
    const reorderedKeys = queryActions.update(grouped, (draft) => {
      draft.query.group_by.push({
        expression: { field_id: "name", node_type: "field", source_id: "src_main" },
      });
    });
    expect(
      localIssues(reorderedKeys).some((issue) => issue.code === "QUERY_GROUPING_INVALID"),
    ).toBe(false);
    expect(queryActions.clearGroupBy(fixed).query.group_by).toEqual([]);
  });

  it("does not require GROUP BY when SELECT contains only aggregate expressions", () => {
    const aggregateOnly = queryActions.update(document(), (draft) => {
      draft.query.select = [
        {
          select_id: "count",
          item_type: "aggregate",
          expression: { node_type: "aggregate", aggregate: "count_all", argument: null },
          label: "Total",
        },
      ];
    });

    expect(
      localIssues(aggregateOnly).filter((issue) => issue.code === "QUERY_GROUPING_INVALID"),
    ).toEqual([]);
  });

  it("adds functions and scalar subqueries required by GROUP BY in the bulk action", () => {
    const mixed = queryActions.update(document(), (draft) => {
      draft.query.select = [
        {
          select_id: "concat",
          item_type: "expression",
          expression: {
            node_type: "function",
            function: "concat",
            arguments: [
              { node_type: "field", source_id: "src_main", field_id: "first_name" },
              { node_type: "field", source_id: "src_main", field_id: "last_name" },
            ],
          },
          label: "Nombre completo",
        },
        {
          select_id: "subquery",
          item_type: "subquery",
          expression: {
            node_type: "subquery",
            query_id: "saved_total",
            query: structuredClone(draft.query),
          },
          label: "Subconsulta total",
        },
        {
          select_id: "count",
          item_type: "aggregate",
          expression: { node_type: "aggregate", aggregate: "count_all", argument: null },
        },
      ];
    });

    expect(
      localIssues(mixed).filter((issue) => issue.code === "QUERY_GROUPING_INVALID"),
    ).toHaveLength(2);
    const grouped = queryActions.addSelectedFieldsToGroupBy(mixed);
    expect(grouped.query.group_by.map((item) => item.expression.node_type)).toEqual([
      "function",
      "subquery",
    ]);
    expect(grouped.query.group_by.map((item) => item.position)).toEqual([1, 2]);
    expect(localIssues(grouped).some((issue) => issue.code === "QUERY_GROUPING_INVALID")).toBe(
      false,
    );
  });
});
