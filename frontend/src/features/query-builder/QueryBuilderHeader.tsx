import { CheckCircle2, Code2, FileJson2, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { BuilderState } from "./state";
import { BackButton } from "../../components/navigation/BackButton";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";
import { routes } from "../../app/router/routes";
import { returnState } from "../../shared/navigation/navigationState";

export function QueryBuilderHeader({
  name,
  connection,
  state,
  canValidate,
  canCompile,
  busy,
  onSave,
  onValidate,
  onCompile,
  onUndo,
  onRedo,
  onReset,
}: {
  name: string;
  connection: string;
  state: BuilderState;
  canValidate: boolean;
  canCompile: boolean;
  busy: string | null;
  onSave: (validate: boolean) => void;
  onValidate: () => void;
  onCompile: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  const location = useLocation();
  return (
    <header className="border-b bg-white px-4 py-3">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
        <BackButton fallback={routes.queries.list()} label="Volver" />
        <Breadcrumbs
          items={[
            { label: "Inicio", to: routes.dashboard() },
            { label: "Consultas", to: routes.queries.list() },
            { label: name },
            { label: "Constructor" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{name}</h1>
            {state.dirty ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                Cambios sin guardar
              </span>
            ) : null}
            {state.readOnly ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Solo lectura</span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {connection} · Revisión {state.revision} · AST {state.workingQuery.schema_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="icon-button"
            disabled={state.readOnly || !state.history.length}
            title="Deshacer (Ctrl+Z)"
            onClick={onUndo}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            className="icon-button"
            disabled={state.readOnly || !state.future.length}
            title="Rehacer (Ctrl+Shift+Z)"
            onClick={onRedo}
          >
            <Redo2 className="size-4" />
          </button>
          <button
            className="icon-button"
            disabled={state.readOnly || !state.dirty}
            title="Descartar cambios"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
          </button>
          <Link
            className="btn-secondary"
            state={returnState(location)}
            to={routes.queries.editJson(state.queryId)}
          >
            <FileJson2 className="size-4" />
            JSON
          </Link>
          <button
            className="btn-secondary"
            disabled={state.readOnly || !state.dirty || Boolean(busy)}
            onClick={() => {
              onSave(false);
            }}
          >
            <Save className="size-4" />
            Guardar
          </button>
          <button
            className="btn-secondary"
            disabled={!canValidate || Boolean(busy)}
            onClick={onValidate}
          >
            <CheckCircle2 className="size-4" />
            {busy === "validate" ? "Validando…" : "Validar"}
          </button>
          <button
            className="btn-primary"
            disabled={
              !canCompile || Boolean(busy) || Boolean(state.validation && !state.validation.valid)
            }
            onClick={onCompile}
          >
            <Code2 className="size-4" />
            {busy === "compile" ? "Compilando…" : "Compilar"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        El SQL es informativo y no editable; la ejecución usa exclusivamente el AST validado.
      </p>
    </header>
  );
}
