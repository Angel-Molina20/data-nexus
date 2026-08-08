import { Network, PanelLeftClose, PanelRightClose } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { QueryExecutionPanel } from "../query-execution/QueryExecutionPanel";
import { AddRelationshipDialog } from "./AddRelationshipDialog";
import { QueryBottomPanel } from "./QueryBottomPanel";
import { QueryBuilderHeader } from "./QueryBuilderHeader";
import { QueryCanvas } from "./QueryCanvas";
import { QueryCatalogPanel } from "./QueryCatalogPanel";
import { QueryInspectorPanel } from "./QueryInspectorPanel";
import { useQueryBuilderController } from "./hooks/useQueryBuilderController";
import { queryActions } from "./state";
import type { SavedQuery } from "../queries/types";
import { UnsavedChangesDialog } from "../../components/navigation/UnsavedChangesDialog";

export function QueryBuilderWorkspace({ savedQuery }: { savedQuery: SavedQuery }) {
  const builder = useQueryBuilderController(savedQuery);
  const { state, dispatch } = builder;
  const columns =
    builder.isCatalogOpen && builder.isInspectorOpen
      ? "lg:grid-cols-[280px_minmax(420px,1fr)_370px]"
      : builder.isCatalogOpen
        ? "lg:grid-cols-[280px_1fr]"
        : builder.isInspectorOpen
          ? "lg:grid-cols-[1fr_370px]"
          : "grid-cols-1";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-100">
      <QueryBuilderHeader
        name={savedQuery.name}
        connection={`${builder.connection.data?.name ?? "Conexión"} · ${builder.connection.data?.engine ?? ""} ${builder.connection.data?.raw_version ?? ""}`}
        state={state}
        canValidate={builder.auth.hasPermission("queries.validate")}
        canCompile={builder.auth.hasPermission("queries.compile")}
        busy={builder.busyAction}
        onSave={builder.saveDocument}
        onValidate={() => {
          void builder.validate();
        }}
        onCompile={() => {
          void builder.compile();
        }}
        onUndo={() => {
          dispatch({ type: "undo" });
        }}
        onRedo={() => {
          dispatch({ type: "redo" });
        }}
        onReset={() => {
          dispatch({ type: "reset" });
        }}
      />
      <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
        <button
          className="btn-secondary min-h-8 px-2 py-1 text-xs"
          onClick={() => {
            builder.setCatalogOpen((value) => !value);
          }}
        >
          <PanelLeftClose className="size-3" />
          Catálogo
        </button>
        <button
          className="btn-secondary min-h-8 px-2 py-1 text-xs"
          disabled={builder.isReadOnly}
          onClick={() => {
            builder.setRelationshipDialogOpen(true);
          }}
        >
          <Network className="size-3" />
          Añadir relación
        </button>
        <button
          className="btn-secondary ml-auto min-h-8 px-2 py-1 text-xs"
          onClick={() => {
            builder.setInspectorOpen((value) => !value);
          }}
        >
          <PanelRightClose className="size-3" />
          Inspector
        </button>
        <button
          className="text-xs font-semibold text-slate-500"
          onClick={() => {
            builder.leave();
          }}
        >
          Cerrar
        </button>
      </div>
      <div
        className={`grid h-[calc(100vh-13rem)] min-h-[460px] flex-none overflow-hidden ${columns}`}
      >
        {builder.isCatalogOpen ? (
          <div className="hidden min-h-0 overflow-hidden lg:block">
            <QueryCatalogPanel
              document={state.workingQuery}
              selectedSourceId={state.selectedSourceId}
              canUseSensitive={builder.auth.hasPermission("queries.use_sensitive_fields")}
              onEntity={(sourceId) => {
                dispatch({ type: "select_source", sourceId });
              }}
              onInspect={(entityId) => {
                const source = [
                  state.workingQuery.query.source,
                  ...state.workingQuery.query.joins.map((join) => join.source),
                ].find((item) => item.entity_id === entityId);
                if (source) dispatch({ type: "select_source", sourceId: source.source_id });
              }}
              onField={(fieldId, label) => {
                builder.modify(
                  queryActions.addField(state.workingQuery, state.selectedSourceId, fieldId, label),
                );
              }}
            />
          </div>
        ) : null}
        <main className="min-h-0 overflow-hidden">
          <QueryCanvas
            document={state.workingQuery}
            entities={builder.entities}
            onLayout={builder.updateLayout}
          />
        </main>
        {builder.isInspectorOpen ? (
          <div className="hidden min-h-0 overflow-hidden lg:block">
            <QueryInspectorPanel
              document={state.workingQuery}
              tab={state.selectedTab}
              readOnly={builder.isReadOnly}
              onTab={(tab) => {
                dispatch({ type: "select_tab", tab });
              }}
              onChange={builder.modify}
            />
          </div>
        ) : null}
      </div>
      <QueryBottomPanel
        state={state}
        localProblems={builder.problems}
        onTab={(tab) => {
          dispatch({ type: "bottom_tab", tab });
        }}
      />
      <QueryExecutionPanel
        document={state.workingQuery}
        queryId={savedQuery.id}
        revision={state.revision}
        canExecute={builder.auth.hasPermission("queries.execute")}
        blocked={
          builder.problems.length > 0 || Boolean(state.validation && !state.validation.valid)
        }
      />
      {builder.isRelationshipDialogOpen ? (
        <AddRelationshipDialog
          document={state.workingQuery}
          onClose={() => {
            builder.setRelationshipDialogOpen(false);
          }}
          onAdd={(join) => {
            builder.modify(queryActions.addJoin(state.workingQuery, join));
            dispatch({ type: "select_source", sourceId: join.source.source_id });
            builder.setRelationshipDialogOpen(false);
          }}
        />
      ) : null}
      <Modal
        open={state.conflict}
        onClose={() => {
          dispatch({ type: "conflict", value: false });
        }}
        title="La consulta cambió en otra sesión"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "conflict", value: false });
              }}
            >
              Conservar copia local
            </Button>
            <Button variant="secondary" onClick={builder.duplicate}>
              Duplicar
            </Button>
            <Button onClick={builder.reload}>Recargar servidor</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          No sobrescribiremos la versión remota. Puedes recargarla o duplicar el borrador conservado
          en el servidor.
        </p>
      </Modal>
      <UnsavedChangesDialog
        onLeave={builder.unsaved.leave}
        onStay={builder.unsaved.stay}
        open={builder.unsaved.isBlocked}
      />
    </div>
  );
}
