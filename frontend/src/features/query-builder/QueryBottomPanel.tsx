import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import type { QueryDocument, QueryIssue } from "../queries/types";
import type { SchemaEntity } from "../schema/types";
import { IconButton } from "../../components/ui/IconButton";
import { QueryFilterEditor } from "./filters/components/QueryFilterEditor";
import type { BottomTab, BuilderState } from "./state";

export function QueryBottomPanel({
  state,
  localProblems,
  onTab,
  collapsed,
  onCollapsedChange,
  results,
  entities,
  readOnly,
  canUseSensitive,
  onDocumentChange,
  filterFocus,
  onFilterIssue,
}: {
  state: BuilderState;
  localProblems: QueryIssue[];
  onTab: (tab: BottomTab) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  results: ReactNode;
  entities: Record<string, SchemaEntity>;
  readOnly: boolean;
  canUseSensitive: boolean;
  onDocumentChange: (document: QueryDocument) => void;
  filterFocus: string | null;
  onFilterIssue: (issue: QueryIssue) => void;
}) {
  const tabs: BottomTab[] = [
    "results",
    "filters",
    "problems",
    "parameters",
    "sql",
    "complexity",
    "json",
  ];
  return (
    <section aria-label="Resultados y validación" className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-10 items-center border-b px-2">
        <div
          aria-label="Panel inferior"
          className="flex min-w-0 flex-1 overflow-x-auto"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-selected={state.bottomTab === tab}
              className={`min-h-10 whitespace-nowrap border-b-2 px-3 text-xs font-semibold ${state.bottomTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}
              key={tab}
              onClick={() => {
                onTab(tab);
                if (collapsed) onCollapsedChange(false);
              }}
              role="tab"
            >
              {names[tab]}
              {tab === "problems" && localProblems.length
                ? ` (${String(localProblems.length)})`
                : ""}
            </button>
          ))}
        </div>
        <IconButton
          label={collapsed ? "Expandir panel inferior" : "Minimizar panel inferior"}
          onClick={() => {
            onCollapsedChange(!collapsed);
          }}
          size="sm"
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </IconButton>
      </div>
      {!collapsed ? (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div hidden={state.bottomTab !== "results"}>{results}</div>
          {state.bottomTab === "filters" ? (
            <QueryFilterEditor
              canUseSensitive={canUseSensitive}
              document={state.workingQuery}
              entities={entities}
              focusIssueId={filterFocus}
              initialArea={filterFocus?.startsWith("having:") ? "having" : "where"}
              onChange={onDocumentChange}
              readOnly={readOnly}
            />
          ) : null}
          {state.bottomTab === "problems" ? (
            <QueryProblemsPanel
              local={localProblems}
              remote={
                state.validation ? [...state.validation.errors, ...state.validation.warnings] : []
              }
              onFilterIssue={onFilterIssue}
            />
          ) : null}
          {state.bottomTab === "parameters" ? (
            <ParameterSummary document={state.workingQuery} />
          ) : null}
          {state.bottomTab === "sql" ? <QuerySqlPanel state={state} /> : null}
          {state.bottomTab === "complexity" ? <Complexity state={state} /> : null}
          {state.bottomTab === "json" ? (
            <pre className="text-xs">{JSON.stringify(state.workingQuery, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
const names: Record<BottomTab, string> = {
  results: "Resultados",
  filters: "Filtros",
  problems: "Problemas",
  parameters: "Parámetros",
  sql: "SQL",
  complexity: "Complejidad",
  json: "JSON técnico",
};
export function QueryProblemsPanel({
  local,
  remote,
  onFilterIssue,
}: {
  local: QueryIssue[];
  remote: QueryIssue[];
  onFilterIssue: (issue: QueryIssue) => void;
}) {
  const items = remote.length ? remote : local;
  if (!items.length)
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="size-4" />
        No hay problemas conocidos. Ejecuta la validación definitiva.
      </p>
    );
  return (
    <div className="space-y-2">
      {items.map((issue, index) => (
        <button
          className="flex w-full items-start gap-2 rounded-lg border p-2 text-left text-sm"
          key={`${issue.code}-${String(index)}`}
          onClick={() => {
            if (issue.path.startsWith("query.where") || issue.path.startsWith("query.having"))
              onFilterIssue(issue);
          }}
        >
          <span>
            {issue.severity === "error" ? (
              <XCircle className="size-4 text-red-600" />
            ) : (
              <TriangleAlert className="size-4 text-amber-600" />
            )}
          </span>
          <span>
            <strong>{issue.code}</strong> — {issue.message}
            <small className="block text-slate-400">{issue.path}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
function ParameterSummary({ document }: { document: QueryDocument }) {
  return document.parameters.length ? (
    <div className="grid gap-2 md:grid-cols-2">
      {document.parameters.map((item) => (
        <div className="rounded-lg border p-3 text-sm" key={item.parameter_id}>
          <strong>{item.label}</strong>
          <p className="text-xs text-slate-500">
            {item.data_type} · {item.required ? "Requerido" : "Opcional"}
            {item.sensitive ? " · Sensible" : ""}
          </p>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-slate-500">No hay parámetros definidos.</p>
  );
}
export function QuerySqlPanel({ state }: { state: BuilderState }) {
  if (!state.compilation)
    return (
      <p className="flex gap-2 text-sm text-slate-500">
        <Info className="size-4" />
        Valida y compila para obtener la vista previa. No se ejecutará la consulta.
      </p>
    );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-700">
          Vista previa únicamente · executed={String(state.compilation.executed)}
        </p>
        <button
          className="btn-secondary min-h-8 px-2 py-1 text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(state.compilation?.sql ?? "");
          }}
        >
          <Copy className="size-3" />
          Copiar
        </button>
      </div>
      <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
        {state.compilation.sql}
      </pre>
    </div>
  );
}
function Complexity({ state }: { state: BuilderState }) {
  const value = state.validation?.complexity ?? state.compilation?.complexity;
  return value ? (
    <div>
      <strong className="text-lg capitalize">Complejidad {value.level}</strong>
      <span className="ml-2 text-sm text-slate-500">Score {value.score}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(value.metrics).map(([key, count]) => (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs" key={key}>
            {key}: {count}
          </span>
        ))}
      </div>
    </div>
  ) : (
    <p className="text-sm text-slate-500">Valida la consulta para calcular su complejidad.</p>
  );
}
