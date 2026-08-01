import { describe, expect, it } from "vitest";

import type { QueryDocument, SavedQuery } from "../queries/types";
import { builderReducer, createBuilderState, localIssues, queryActions } from "./state";

const document = (): QueryDocument => ({ schema_version: "1.0", connection_id: "connection", query: { scope_id: "root", query_type: "select", source: { source_id: "src_main", entity_id: "entity", alias: "main" }, joins: [], select: [{ select_id: "literal", item_type: "literal", expression: { node_type: "literal", value_type: "integer", value: 1 } }], group_by: [], order_by: [], distinct: false, unions: [] }, parameters: [], metadata: {}, options: {} });
const saved = (): SavedQuery => ({ id: "query", name: "Consulta", description: null, connection_id: "connection", owner_user_id: "user", document: document(), schema_version: "1.0", status: "draft", validation_status: "not_validated", validation_errors: [], validation_warnings: [], fingerprint: null, complexity: null, revision: 1, last_validated_at: null, created_at: "2026-08-01", updated_at: "2026-08-01" });

describe("query builder state", () => {
  it("adds fields immutably and supports undo/redo", () => {
    const initial = createBuilderState(saved(), false);
    const changed = queryActions.addField(initial.workingQuery, "src_main", "field", "Nombre");
    expect(initial.workingQuery.query.select).toHaveLength(1);
    const edited = builderReducer(initial, { type: "replace", document: changed });
    expect(edited.dirty).toBe(true); expect(edited.workingQuery.query.select).toHaveLength(2);
    const undone = builderReducer(edited, { type: "undo" });
    expect(undone.workingQuery.query.select).toHaveLength(1);
    const redone = builderReducer(undone, { type: "redo" });
    expect(redone.workingQuery.query.select).toHaveLength(2);
  });

  it("keeps read-only mode immutable and validates duplicate aliases", () => {
    const initial = createBuilderState(saved(), true);
    const changed = queryActions.setBodyValue(initial.workingQuery, { distinct: true });
    expect(builderReducer(initial, { type: "replace", document: changed })).toBe(initial);
    const joined = queryActions.addJoin(document(), { join_id: "join", join_type: "cross", source: { source_id: "src_two", entity_id: "other", alias: "main" }, options: {} });
    expect(localIssues(joined).some((issue) => issue.code === "QUERY_SOURCE_ALIAS_DUPLICATE")).toBe(true);
  });

  it("stores layout apart from semantic query operations", () => {
    const next = queryActions.update(document(), (draft) => { draft.metadata.builder_layout = { nodes: { src_main: { x: 120, y: 80, collapsed: false } }, panels: { catalog_width: 280, inspector_width: 360 } }; });
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
});
