import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, PanelLeftClose, PanelRightClose } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AddRelationshipDialog } from "../features/query-builder/AddRelationshipDialog";
import { QueryBottomPanel } from "../features/query-builder/QueryBottomPanel";
import { QueryBuilderHeader } from "../features/query-builder/QueryBuilderHeader";
import { QueryCanvas } from "../features/query-builder/QueryCanvas";
import { QueryCatalogPanel } from "../features/query-builder/QueryCatalogPanel";
import { QueryInspectorPanel } from "../features/query-builder/QueryInspectorPanel";
import { builderReducer, createBuilderState, localIssues, queryActions } from "../features/query-builder/state";
import { useAuth } from "../features/auth/context";
import type { QueryDocument } from "../features/queries/types";
import type { SchemaEntity } from "../features/schema/types";
import { getConnection } from "../services/connections";
import { getSchemaEntity } from "../services/schema";
import { compileUniversalQuery, duplicateQuery, getQuery, updateQuery, validateQueryModel } from "../services/queries";
import { ApiError } from "../services/shared";

export function QueryBuilderPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const client = useQueryClient(); const auth = useAuth();
  const saved = useQuery({ queryKey: ["query", id], queryFn: () => getQuery(id) });
  if (saved.isPending) return <div className="state-message">Cargando constructor…</div>;
  if (saved.isError) return <div className="alert-error m-6">No fue posible abrir el constructor.</div>;
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return <Builder key={`${saved.data.id}-${saved.data.revision}`} saved={saved.data} auth={auth} navigate={navigate} client={client} />;
}

function Builder({ saved, auth, navigate, client }: { saved: Awaited<ReturnType<typeof getQuery>>; auth: ReturnType<typeof useAuth>; navigate: ReturnType<typeof useNavigate>; client: ReturnType<typeof useQueryClient> }) {
  const readOnly = !auth.hasPermission("queries.update"); const [state, dispatch] = useReducer(builderReducer, createBuilderState(saved, readOnly)); const [busy, setBusy] = useState<string | null>(null); const [relationOpen, setRelationOpen] = useState(false); const [catalogOpen, setCatalogOpen] = useState(true); const [inspectorOpen, setInspectorOpen] = useState(true);
  const connection = useQuery({ queryKey: ["connection", saved.connection_id], queryFn: () => getConnection(saved.connection_id) });
  const sourceIds = useMemo(() => [state.workingQuery.query.source.entity_id, ...state.workingQuery.query.joins.map((join) => join.source.entity_id)], [state.workingQuery]);
  const entityQueries = useQueries({ queries: sourceIds.map((entityId) => ({ queryKey: ["builder-entity", saved.connection_id, entityId], queryFn: () => getSchemaEntity(saved.connection_id, entityId) })) });
  const entities = useMemo(() => Object.fromEntries(entityQueries.flatMap((query) => query.data ? [[query.data.id, query.data] as [string, SchemaEntity]] : [])), [entityQueries]);
  const problems = useMemo(() => localIssues(state.workingQuery), [state.workingQuery]);
  useEffect(() => { const before = (event: BeforeUnloadEvent) => { if (state.dirty) event.preventDefault(); }; window.addEventListener("beforeunload", before); return () => { window.removeEventListener("beforeunload", before); }; }, [state.dirty]);
  useEffect(() => { const keyboard = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target?.matches("input, textarea, select, [contenteditable=true]")) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); dispatch({ type: event.shiftKey ? "redo" : "undo" }); } }; window.addEventListener("keydown", keyboard); return () => { window.removeEventListener("keydown", keyboard); }; }, []);

  const save = useMutation({ mutationFn: (document: QueryDocument) => updateQuery(saved.id, { revision: state.revision, document }), onSuccess: (value) => { dispatch({ type: "saved", saved: value }); client.setQueryData(["query", saved.id], value); void client.invalidateQueries({ queryKey: ["queries"] }); }, onError: (error) => { if (error instanceof ApiError && error.code === "QUERY_REVISION_CONFLICT") dispatch({ type: "conflict", value: true }); }, onSettled: () => { setBusy(null); } });
  const validate = async () => { if (problems.length) { dispatch({ type: "bottom_tab", tab: "problems" }); return; } setBusy("validate"); try { dispatch({ type: "validation", value: await validateQueryModel(state.workingQuery) }); } finally { setBusy(null); } };
  const compile = async () => { setBusy("compile"); try { const result = await compileUniversalQuery(state.workingQuery); dispatch({ type: "compilation", value: result }); } finally { setBusy(null); } };
  const modify = (document: QueryDocument) => { dispatch({ type: "replace", document }); };
  const layout = (sourceId: string, x: number, y: number) => { modify(queryActions.update(state.workingQuery, (draft) => { const current = draft.metadata.builder_layout ?? { nodes: {}, panels: { catalog_width: 280, inspector_width: 360 } }; current.nodes[sourceId] = { x, y, collapsed: current.nodes[sourceId]?.collapsed ?? false }; draft.metadata.builder_layout = current; })); };
  const leave = (path: string) => { if (!state.dirty || window.confirm("Hay cambios sin guardar. ¿Salir sin guardarlos?")) void navigate(path); };
  return <div className="flex h-[calc(100vh-4rem)] min-h-[680px] flex-col overflow-hidden bg-slate-100">
    <QueryBuilderHeader name={saved.name} connection={`${connection.data?.name ?? "Conexión"} · ${connection.data?.engine ?? ""} ${connection.data?.raw_version ?? ""}`} state={state} canValidate={auth.hasPermission("queries.validate")} canCompile={auth.hasPermission("queries.compile")} busy={busy} onSave={(andValidate) => { setBusy("save"); save.mutate(state.workingQuery, { onSuccess: () => { if (andValidate) void validate(); } }); }} onValidate={() => { void validate(); }} onCompile={() => { void compile(); }} onUndo={() => { dispatch({ type: "undo" }); }} onRedo={() => { dispatch({ type: "redo" }); }} onReset={() => { dispatch({ type: "reset" }); }} />
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2"><button className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={() => { setCatalogOpen((value) => !value); }}><PanelLeftClose className="size-3" />Catálogo</button><button className="btn-secondary min-h-8 px-2 py-1 text-xs" disabled={readOnly} onClick={() => { setRelationOpen(true); }}><Network className="size-3" />Añadir relación</button><button className="btn-secondary ml-auto min-h-8 px-2 py-1 text-xs" onClick={() => { setInspectorOpen((value) => !value); }}><PanelRightClose className="size-3" />Inspector</button><button className="text-xs font-semibold text-slate-500" onClick={() => { leave(`/queries/${saved.id}`); }}>Cerrar</button></div>
    <div className={`grid min-h-0 flex-1 ${catalogOpen && inspectorOpen ? "lg:grid-cols-[280px_minmax(420px,1fr)_370px]" : catalogOpen ? "lg:grid-cols-[280px_1fr]" : inspectorOpen ? "lg:grid-cols-[1fr_370px]" : "grid-cols-1"}`}>{catalogOpen ? <div className="hidden min-h-0 lg:block"><QueryCatalogPanel document={state.workingQuery} selectedSourceId={state.selectedSourceId} canUseSensitive={auth.hasPermission("queries.use_sensitive_fields")} onEntity={(sourceId) => { dispatch({ type: "select_source", sourceId }); }} onInspect={(entityId) => { const source = [state.workingQuery.query.source, ...state.workingQuery.query.joins.map((join) => join.source)].find((item) => item.entity_id === entityId); if (source) dispatch({ type: "select_source", sourceId: source.source_id }); }} onField={(fieldId, label) => { modify(queryActions.addField(state.workingQuery, state.selectedSourceId, fieldId, label)); }} /></div> : null}<main className="min-h-0"><QueryCanvas document={state.workingQuery} entities={entities} onLayout={layout} /></main>{inspectorOpen ? <div className="hidden min-h-0 lg:block"><QueryInspectorPanel document={state.workingQuery} tab={state.selectedTab} readOnly={readOnly} onTab={(tab) => { dispatch({ type: "select_tab", tab }); }} onChange={modify} /></div> : null}</div>
    <QueryBottomPanel state={state} localProblems={problems} onTab={(tab) => { dispatch({ type: "bottom_tab", tab }); }} />
    {relationOpen ? <AddRelationshipDialog document={state.workingQuery} onClose={() => { setRelationOpen(false); }} onAdd={(join) => { modify(queryActions.addJoin(state.workingQuery, join)); dispatch({ type: "select_source", sourceId: join.source.source_id }); setRelationOpen(false); }} /> : null}
    {state.conflict ? <Conflict onClose={() => { dispatch({ type: "conflict", value: false }); }} onReload={() => { void client.invalidateQueries({ queryKey: ["query", saved.id] }); dispatch({ type: "conflict", value: false }); }} onDuplicate={() => { void duplicateQuery(saved.id).then((copy) => navigate(`/queries/${copy.id}/builder`)); }} /> : null}
  </div>;
}

function Conflict({ onClose, onReload, onDuplicate }: { onClose: () => void; onReload: () => void; onDuplicate: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="alertdialog" aria-modal="true"><div className="max-w-lg rounded-xl bg-white p-6"><h2 className="text-lg font-bold">La consulta cambió en otra sesión</h2><p className="mt-2 text-sm text-slate-600">No sobrescribiremos la versión remota. Puedes recargarla o duplicar el borrador conservado en el servidor.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Conservar copia local</button><button className="btn-secondary" onClick={onDuplicate}>Duplicar</button><button className="btn-primary" onClick={onReload}>Recargar servidor</button></div></div></div>; }
