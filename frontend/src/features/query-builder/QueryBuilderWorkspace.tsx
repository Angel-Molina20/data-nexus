import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { UnsavedChangesDialog } from "../../components/navigation/UnsavedChangesDialog";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import type { QueryExecutionState } from "../query-execution/QueryExecutionPanel";
import { QueryExecutionPanel } from "../query-execution/QueryExecutionPanel";
import type { SavedQuery } from "../queries/types";
import { AddRelationshipDialog } from "./AddRelationshipDialog";
import { QueryBottomPanel } from "./QueryBottomPanel";
import { QueryBuilderHeader } from "./QueryBuilderHeader";
import { QueryCanvas } from "./QueryCanvas";
import { QueryCatalogPanel } from "./QueryCatalogPanel";
import { QueryInspectorPanel } from "./QueryInspectorPanel";
import { useQueryBuilderController } from "./hooks/useQueryBuilderController";
import { queryActions } from "./state";
import { QueryBuilderResizeHandle } from "./workspace/QueryBuilderResizeHandle";
import {
  DEFAULT_QUERY_BUILDER_LAYOUT,
  queryBuilderLayoutLimits,
} from "./workspace/queryBuilderLayoutPreferences";
import { useQueryBuilderLayout } from "./workspace/useQueryBuilderLayout";

const idleExecution: QueryExecutionState = { canRun: false, hasResult: false, status: "idle" };

export function QueryBuilderWorkspace({ savedQuery }: { savedQuery: SavedQuery }) {
  const builder = useQueryBuilderController(savedQuery);
  const layout = useQueryBuilderLayout();
  const { state, dispatch } = builder;
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(state.selectedSourceId);
  const [selectedJoinId, setSelectedJoinId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"catalog" | "inspector" | null>(null);
  const [execution, setExecution] = useState(idleExecution);
  const [executeRequest, setExecuteRequest] = useState(0);
  const [cancelRequest, setCancelRequest] = useState(0);

  const leftVisible = !layout.focusMode && !layout.preferences.leftCollapsed;
  const rightVisible = !layout.focusMode && !layout.preferences.rightCollapsed;
  const bottomCollapsed = layout.focusMode || layout.preferences.bottomCollapsed;
  const gridStyle = {
    "--builder-left-width": `${String(layout.preferences.leftWidth)}px`,
    "--builder-right-width": `${String(layout.preferences.rightWidth)}px`,
  } as CSSProperties;
  const resizeKey = [
    leftVisible,
    rightVisible,
    bottomCollapsed,
    layout.preferences.leftWidth,
    layout.preferences.rightWidth,
    layout.preferences.bottomHeight,
  ].join(":");

  const catalog = (
    <QueryCatalogPanel
      canUseSensitive={builder.auth.hasPermission("queries.use_sensitive_fields")}
      document={state.workingQuery}
      onEntity={(sourceId) => {
        dispatch({ type: "select_source", sourceId });
        setSelectedJoinId(null);
        setSelectedSourceId(sourceId);
      }}
      onField={(fieldId, label) => {
        builder.modify(
          queryActions.addField(state.workingQuery, state.selectedSourceId, fieldId, label),
        );
      }}
      onInspect={(entityId) => {
        const source = [
          state.workingQuery.query.source,
          ...state.workingQuery.query.joins.map((join) => join.source),
        ].find((item) => item.entity_id === entityId);
        if (source) {
          dispatch({ type: "select_source", sourceId: source.source_id });
          setSelectedJoinId(null);
          setSelectedSourceId(source.source_id);
        }
      }}
      selectedSourceId={state.selectedSourceId}
    />
  );
  const inspector = (
    <QueryInspectorPanel
      document={state.workingQuery}
      entities={builder.entities}
      onChange={builder.modify}
      onTab={(tab) => {
        dispatch({ type: "select_tab", tab });
      }}
      readOnly={builder.isReadOnly}
      selectedJoinId={selectedJoinId}
      selectedSourceId={selectedSourceId}
      tab={state.selectedTab}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100">
      <QueryBuilderHeader
        bottomCollapsed={bottomCollapsed}
        busy={builder.busyAction}
        canCompile={builder.auth.hasPermission("queries.compile")}
        canExecute={builder.auth.hasPermission("queries.execute")}
        canValidate={builder.auth.hasPermission("queries.validate")}
        connection={`${builder.connection.data?.name ?? "Conexión"} · ${builder.connection.data?.engine ?? ""} ${builder.connection.data?.raw_version ?? ""}`}
        execution={execution}
        focusMode={layout.focusMode}
        leftCollapsed={!leftVisible}
        name={savedQuery.name}
        onAddRelationship={() => {
          builder.setRelationshipDialogOpen(true);
        }}
        onCancel={() => {
          setCancelRequest((value) => value + 1);
        }}
        onCompile={() => {
          layout.update({ bottomCollapsed: false });
          void builder.compile();
        }}
        onExecute={() => {
          dispatch({ type: "bottom_tab", tab: "results" });
          layout.update({ bottomCollapsed: false });
          setExecuteRequest((value) => value + 1);
        }}
        onRedo={() => {
          dispatch({ type: "redo" });
        }}
        onResetDocument={() => {
          dispatch({ type: "reset" });
        }}
        onResetLayout={layout.reset}
        onSave={builder.saveDocument}
        onToggleBottom={() => {
          if (layout.focusMode) layout.setFocusMode(false);
          else layout.update({ bottomCollapsed: !layout.preferences.bottomCollapsed });
        }}
        onToggleFocus={() => {
          layout.setFocusMode(!layout.focusMode);
        }}
        onToggleLeft={() => {
          if (layout.focusMode) layout.setFocusMode(false);
          else layout.update({ leftCollapsed: !layout.preferences.leftCollapsed });
        }}
        onToggleRight={() => {
          if (layout.focusMode) layout.setFocusMode(false);
          else layout.update({ rightCollapsed: !layout.preferences.rightCollapsed });
        }}
        onUndo={() => {
          dispatch({ type: "undo" });
        }}
        onValidate={() => {
          layout.update({ bottomCollapsed: false });
          void builder.validate();
        }}
        rightCollapsed={!rightVisible}
        saveError={builder.save.isError}
        state={state}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <div className="absolute left-2 top-2 z-10 flex gap-1 min-[1200px]:hidden">
            <Button
              onClick={() => {
                setMobilePanel("catalog");
              }}
              size="sm"
              startIcon={<PanelLeftOpen className="size-4" />}
              variant="secondary"
            >
              Catálogo
            </Button>
            <Button
              onClick={() => {
                setMobilePanel("inspector");
              }}
              size="sm"
              startIcon={<PanelRightOpen className="size-4" />}
              variant="secondary"
            >
              Inspector
            </Button>
          </div>
          <div
            className="query-builder-grid h-full min-h-0"
            data-left={leftVisible}
            data-right={rightVisible}
            style={gridStyle}
          >
            {leftVisible ? (
              <div className="query-builder-desktop-panel min-h-0 overflow-hidden">{catalog}</div>
            ) : null}
            {leftVisible ? (
              <QueryBuilderResizeHandle
                direction="vertical"
                label="Redimensionar catálogo"
                max={queryBuilderLayoutLimits.leftWidth[1]}
                min={queryBuilderLayoutLimits.leftWidth[0]}
                onChange={(leftWidth) => {
                  layout.update({ leftWidth });
                }}
                onReset={() => {
                  layout.update({ leftWidth: DEFAULT_QUERY_BUILDER_LAYOUT.leftWidth });
                }}
                value={layout.preferences.leftWidth}
              />
            ) : null}
            <main className="min-h-0 min-w-0 overflow-hidden">
              <QueryCanvas
                document={state.workingQuery}
                entities={builder.entities}
                onLayout={builder.updateLayout}
                onSelectJoin={setSelectedJoinId}
                onSelectSource={(sourceId) => {
                  setSelectedSourceId(sourceId);
                  if (sourceId) dispatch({ type: "select_source", sourceId });
                }}
                resizeKey={resizeKey}
                selectedJoinId={selectedJoinId}
                selectedSourceId={selectedSourceId}
              />
            </main>
            {rightVisible ? (
              <QueryBuilderResizeHandle
                direction="vertical"
                label="Redimensionar inspector"
                max={queryBuilderLayoutLimits.rightWidth[1]}
                min={queryBuilderLayoutLimits.rightWidth[0]}
                onChange={(rightWidth) => {
                  layout.update({ rightWidth });
                }}
                onReset={() => {
                  layout.update({ rightWidth: DEFAULT_QUERY_BUILDER_LAYOUT.rightWidth });
                }}
                reverse
                value={layout.preferences.rightWidth}
              />
            ) : null}
            {rightVisible ? (
              <div className="query-builder-desktop-panel min-h-0 overflow-hidden">{inspector}</div>
            ) : null}
          </div>
        </div>

        {!bottomCollapsed ? (
          <QueryBuilderResizeHandle
            direction="horizontal"
            label="Redimensionar panel inferior"
            max={queryBuilderLayoutLimits.bottomHeight[1]}
            min={queryBuilderLayoutLimits.bottomHeight[0]}
            onChange={(bottomHeight) => {
              layout.update({ bottomHeight });
            }}
            onReset={() => {
              layout.update({ bottomHeight: DEFAULT_QUERY_BUILDER_LAYOUT.bottomHeight });
            }}
            reverse
            value={layout.preferences.bottomHeight}
          />
        ) : null}
        <div
          className="min-h-0 shrink-0 border-t border-border"
          style={{ height: bottomCollapsed ? 41 : layout.preferences.bottomHeight }}
        >
          <QueryBottomPanel
            collapsed={bottomCollapsed}
            localProblems={builder.problems}
            onCollapsedChange={(collapsed) => {
              if (layout.focusMode && !collapsed) layout.setFocusMode(false);
              layout.update({ bottomCollapsed: collapsed });
            }}
            onTab={(tab) => {
              dispatch({ type: "bottom_tab", tab });
            }}
            results={
              <QueryExecutionPanel
                blocked={
                  builder.problems.length > 0 ||
                  Boolean(state.validation && !state.validation.valid)
                }
                canExecute={builder.auth.hasPermission("queries.execute")}
                cancelRequest={cancelRequest}
                compact
                document={state.workingQuery}
                executeRequest={executeRequest}
                onStateChange={setExecution}
                queryId={savedQuery.id}
                revision={state.revision}
              />
            }
            state={state}
          />
        </div>
      </div>

      <Drawer
        onClose={() => {
          setMobilePanel(null);
        }}
        open={mobilePanel === "catalog"}
        position="left"
        title="Catálogo"
      >
        <div className="h-full min-h-[28rem]">{catalog}</div>
      </Drawer>
      <Drawer
        onClose={() => {
          setMobilePanel(null);
        }}
        open={mobilePanel === "inspector"}
        title="Inspector"
      >
        <div className="h-full min-h-[28rem]">{inspector}</div>
      </Drawer>
      {builder.isRelationshipDialogOpen ? (
        <AddRelationshipDialog
          document={state.workingQuery}
          onAdd={(join) => {
            builder.modify(queryActions.addJoin(state.workingQuery, join));
            dispatch({ type: "select_source", sourceId: join.source.source_id });
            setSelectedSourceId(join.source.source_id);
            builder.setRelationshipDialogOpen(false);
          }}
          onClose={() => {
            builder.setRelationshipDialogOpen(false);
          }}
        />
      ) : null}
      <Modal
        footer={
          <>
            <Button
              onClick={() => {
                dispatch({ type: "conflict", value: false });
              }}
              variant="secondary"
            >
              Conservar copia local
            </Button>
            <Button onClick={builder.duplicate} variant="secondary">
              Duplicar
            </Button>
            <Button onClick={builder.reload}>Recargar servidor</Button>
          </>
        }
        onClose={() => {
          dispatch({ type: "conflict", value: false });
        }}
        open={state.conflict}
        title="La consulta cambió en otra sesión"
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
