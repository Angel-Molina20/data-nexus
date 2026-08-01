import type { CompilationResult, QueryBody, QueryDocument, QueryExpression, QueryIssue, QueryJoin, QueryParameter, QuerySelectItem, SavedQuery, ValidationResult } from "../queries/types";

/* eslint-disable @typescript-eslint/no-non-null-assertion -- guarded array history operations */

export type BuilderTab = "fields" | "filters" | "grouping" | "order" | "parameters" | "unions";
export type BottomTab = "problems" | "parameters" | "sql" | "complexity" | "json";

export interface BuilderState {
  queryId: string; revision: number; originalQuery: QueryDocument; workingQuery: QueryDocument;
  validation: ValidationResult | null; compilation: CompilationResult | null;
  selectedSourceId: string; selectedTab: BuilderTab; bottomTab: BottomTab;
  dirty: boolean; readOnly: boolean; history: QueryDocument[]; future: QueryDocument[];
  conflict: boolean;
}

export type BuilderAction =
  | { type: "replace"; document: QueryDocument }
  | { type: "saved"; saved: SavedQuery }
  | { type: "validation"; value: ValidationResult }
  | { type: "compilation"; value: CompilationResult }
  | { type: "select_source"; sourceId: string }
  | { type: "select_tab"; tab: BuilderTab }
  | { type: "bottom_tab"; tab: BottomTab }
  | { type: "conflict"; value: boolean }
  | { type: "undo" } | { type: "redo" } | { type: "reset" };

const clone = <T,>(value: T): T => structuredClone(value);
export const canonical = (value: QueryDocument) => JSON.stringify(value);

export function createBuilderState(saved: SavedQuery, readOnly: boolean): BuilderState {
  return { queryId: saved.id, revision: saved.revision, originalQuery: clone(saved.document), workingQuery: clone(saved.document), validation: null, compilation: null, selectedSourceId: saved.document.query.source.source_id, selectedTab: "fields", bottomTab: "problems", dirty: false, readOnly, history: [], future: [], conflict: false };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const limit = Number(import.meta.env.VITE_QUERY_BUILDER_HISTORY_LIMIT ?? 100);
  if (action.type === "replace") {
    if (state.readOnly || canonical(action.document) === canonical(state.workingQuery)) return state;
    return { ...state, history: [...state.history, clone(state.workingQuery)].slice(-limit), future: [], workingQuery: clone(action.document), dirty: canonical(action.document) !== canonical(state.originalQuery), validation: null, compilation: null };
  }
  if (action.type === "undo" && state.history.length) {
    const previous = state.history.at(-1)!;
    return { ...state, workingQuery: clone(previous), history: state.history.slice(0, -1), future: [clone(state.workingQuery), ...state.future], dirty: canonical(previous) !== canonical(state.originalQuery), validation: null, compilation: null };
  }
  if (action.type === "redo" && state.future.length) {
    const next = state.future[0]!;
    return { ...state, workingQuery: clone(next), history: [...state.history, clone(state.workingQuery)].slice(-limit), future: state.future.slice(1), dirty: canonical(next) !== canonical(state.originalQuery), validation: null, compilation: null };
  }
  if (action.type === "reset") return { ...state, workingQuery: clone(state.originalQuery), history: [], future: [], dirty: false, validation: null, compilation: null };
  if (action.type === "saved") return { ...state, revision: action.saved.revision, originalQuery: clone(action.saved.document), workingQuery: clone(action.saved.document), history: [], future: [], dirty: false, conflict: false };
  if (action.type === "validation") return { ...state, validation: action.value, bottomTab: "problems" };
  if (action.type === "compilation") return { ...state, compilation: action.value, bottomTab: "sql" };
  if (action.type === "select_source") return { ...state, selectedSourceId: action.sourceId };
  if (action.type === "select_tab") return { ...state, selectedTab: action.tab };
  if (action.type === "bottom_tab") return { ...state, bottomTab: action.tab };
  if (action.type === "conflict") return { ...state, conflict: action.value };
  return state;
}

export const queryActions = {
  update(document: QueryDocument, mutate: (draft: QueryDocument) => void) { const next = clone(document); mutate(next); return next; },
  addField(document: QueryDocument, sourceId: string, fieldId: string, label: string): QueryDocument {
    return this.update(document, (draft) => { if (draft.query.select.some((item) => item.expression.node_type === "field" && item.expression.field_id === fieldId && item.expression.source_id === sourceId)) return; draft.query.select.push({ select_id: uniqueId("field"), item_type: "field", expression: { node_type: "field", source_id: sourceId, field_id: fieldId }, label, hidden: false }); });
  },
  removeSelect(document: QueryDocument, selectId: string) { return this.update(document, (draft) => { if (draft.query.select.length > 1) draft.query.select = draft.query.select.filter((item) => item.select_id !== selectId); }); },
  reorderSelect(document: QueryDocument, index: number, direction: -1 | 1) { return this.update(document, (draft) => { const target = index + direction; if (target < 0 || target >= draft.query.select.length) return; const current = draft.query.select[index]!; draft.query.select[index] = draft.query.select[target]!; draft.query.select[target] = current; }); },
  updateSelect(document: QueryDocument, selectId: string, values: Partial<QuerySelectItem>) { return this.update(document, (draft) => { const item = draft.query.select.find((entry) => entry.select_id === selectId); if (item) Object.assign(item, values); }); },
  addJoin(document: QueryDocument, join: QueryJoin) { return this.update(document, (draft) => { draft.query.joins.push(join); }); },
  removeJoin(document: QueryDocument, joinId: string) { return this.update(document, (draft) => { const removed = draft.query.joins.find((item) => item.join_id === joinId); draft.query.joins = draft.query.joins.filter((item) => item.join_id !== joinId); if (removed) cleanupSource(draft.query, removed.source.source_id); }); },
  setPredicate(document: QueryDocument, area: "where" | "having", expression: QueryExpression | null) { return this.update(document, (draft) => { draft.query[area] = expression; }); },
  addGroupBy(document: QueryDocument, expression: QueryExpression) { return this.update(document, (draft) => { draft.query.group_by.push({ expression }); }); },
  addOrderBy(document: QueryDocument, expression: QueryExpression) { return this.update(document, (draft) => { draft.query.order_by.push({ expression, direction: "ascending", nulls: "engine_default" }); }); },
  addParameter(document: QueryDocument, parameter: QueryParameter) { return this.update(document, (draft) => { draft.parameters.push(parameter); }); },
  setBodyValue(document: QueryDocument, values: Partial<QueryBody>) { return this.update(document, (draft) => { Object.assign(draft.query, values); }); },
};

function cleanupSource(body: QueryBody, sourceId: string) {
  const uses = (expression: QueryExpression): boolean => expression.source_id === sourceId || Object.values(expression).some((value) => value && typeof value === "object" && (Array.isArray(value) ? value.some((item) => typeof item === "object" && uses(item as QueryExpression)) : uses(value as QueryExpression)));
  body.select = body.select.filter((item) => !uses(item.expression));
  body.group_by = body.group_by.filter((item) => !uses(item.expression));
  body.order_by = body.order_by.filter((item) => !uses(item.expression));
  if (body.where && uses(body.where)) body.where = null;
  if (body.having && uses(body.having)) body.having = null;
}

export const uniqueId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
export const localIssues = (document: QueryDocument): QueryIssue[] => {
  const issues: QueryIssue[] = [];
  const sources = [document.query.source, ...document.query.joins.map((item) => item.source)];
  const aliases = new Set<string>();
  for (const source of sources) { if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(source.alias)) issues.push({ code: "QUERY_BUILDER_STATE_INVALID", message: "El alias debe comenzar con una letra y no contener espacios.", severity: "error", path: "query.source.alias", node_id: source.source_id }); if (aliases.has(source.alias)) issues.push({ code: "QUERY_SOURCE_ALIAS_DUPLICATE", message: `El alias ${source.alias} está duplicado.`, severity: "error", path: "query.joins", node_id: source.source_id }); aliases.add(source.alias); }
  if (!document.query.select.length) issues.push({ code: "QUERY_BUILDER_EXPRESSION_INCOMPLETE", message: "Selecciona al menos un campo o expresión.", severity: "error", path: "query.select", node_id: null });
  return issues;
};
