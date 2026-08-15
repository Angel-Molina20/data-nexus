import { Copy, Info, LoaderCircle, Play, RotateCw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { QueryDocument } from "../queries/types";
import type { CompilationResult } from "../queries/types";
import { ApiError } from "../../shared/api/httpClient";
import { cancelExecution, executeQuery } from "./api/executionsApi";
import { QueryParametersPanel } from "./QueryParametersPanel";
import { QueryResultsTable } from "./QueryResultsTable";
import type { ExecutionResult } from "./types";

export function QueryExecutionPanel({
  document,
  queryId,
  revision,
  canExecute,
  blocked,
  cancelRequest = 0,
  compact = false,
  executeRequest = 0,
  onStateChange,
  compilation = null,
  mode = "results",
  onExecuted,
  onCompile,
  compiling = false,
}: {
  document: QueryDocument;
  queryId: string;
  revision: number;
  canExecute: boolean;
  blocked: boolean;
  cancelRequest?: number;
  compact?: boolean;
  executeRequest?: number;
  onStateChange?: (state: QueryExecutionState) => void;
  compilation?: CompilationResult | null;
  mode?: "sql" | "results";
  onExecuted?: () => void;
  onCompile?: () => void;
  compiling?: boolean;
}) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        document.parameters.flatMap((item) =>
          item.default_value === undefined || item.sensitive
            ? []
            : [[item.parameter_id, item.default_value]],
        ),
      ),
    [document.parameters],
  );
  const [values, setValues] = useState<Record<string, unknown>>(defaults);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [status, setStatus] = useState<"idle" | "executing" | "failed" | "cancelling">("idle");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const abort = useRef<AbortController | null>(null);
  const run = async (nextPage = page, nextSize = pageSize) => {
    const executionId = crypto.randomUUID();
    const controller = new AbortController();
    setActiveExecutionId(executionId);
    setStatus("executing");
    setError(null);
    abort.current = controller;
    try {
      const response = await executeQuery(
        {
          execution_id: executionId,
          connection_id: document.connection_id,
          query_id: queryId,
          query_revision: revision,
          ast: document,
          parameters: values,
          pagination: { page: nextPage, page_size: nextSize },
          options: { include_total_count: false, include_compiled_sql: false },
        },
        controller.signal,
      );
      setResult(response);
      setPage(nextPage);
      setPageSize(nextSize);
      setStatus("idle");
      onExecuted?.();
    } catch (caught) {
      if (controller.signal.aborted) {
        setStatus("idle");
        setError("La ejecución fue cancelada.");
      } else {
        setStatus("failed");
        setError(
          caught instanceof ApiError ? caught.message : "No fue posible ejecutar la consulta.",
        );
      }
    } finally {
      setActiveExecutionId(null);
    }
  };
  const cancel = async () => {
    setStatus("cancelling");
    if (activeExecutionId) await cancelExecution(activeExecutionId);
    abort.current?.abort();
    setStatus("idle");
  };
  const missing = document.parameters.some(
    (item) =>
      item.required &&
      !item.nullable &&
      (values[item.parameter_id] === undefined || values[item.parameter_id] === ""),
  );
  const totalPages = result?.execution.total_pages;
  const executionState = useMemo<QueryExecutionState>(
    () => ({
      canRun: canExecute && !blocked && !missing,
      hasResult: Boolean(result),
      status,
    }),
    [blocked, canExecute, missing, result, status],
  );
  const lastExecuteRequest = useRef(executeRequest);
  const lastCancelRequest = useRef(cancelRequest);
  useEffect(() => {
    onStateChange?.(executionState);
  }, [executionState, onStateChange]);
  useEffect(() => {
    if (executeRequest !== lastExecuteRequest.current) {
      lastExecuteRequest.current = executeRequest;
      void run(1, pageSize);
    }
    // run intentionally reads the latest parameter values for an imperative toolbar request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executeRequest]);
  useEffect(() => {
    if (cancelRequest !== lastCancelRequest.current) {
      lastCancelRequest.current = cancelRequest;
      void cancel();
    }
    // cancel intentionally reads the active execution at the moment of the toolbar request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelRequest]);
  if (mode === "sql") {
    return (
      <SqlExecutionView
        compilation={compilation}
        document={document}
        error={error}
        compiling={compiling}
        onCompile={onCompile}
        values={values}
        onChange={(id, value) => {
          setValues((current) => ({ ...current, [id]: value }));
        }}
      />
    );
  }
  return (
    <section
      className={compact ? "h-full min-h-0 overflow-hidden bg-white" : "border-t bg-white"}
      aria-live="polite"
    >
      {!compact ? (
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="mr-auto">
            <h2 className="font-bold">Resultados</h2>
            <p className="text-xs text-slate-500">Ejecución segura desde el AST validado</p>
          </div>
          {status === "executing" || status === "cancelling" ? (
            <button
              className="btn-secondary"
              onClick={() => {
                void cancel();
              }}
            >
              <Square className="size-4" />
              {status === "cancelling" ? "Cancelando…" : "Cancelar"}
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={!canExecute || blocked || missing}
              onClick={() => {
                void run(1, pageSize);
              }}
            >
              {result ? <RotateCw className="size-4" /> : <Play className="size-4" />}
              {result ? "Volver a ejecutar" : "Ejecutar consulta"}
            </button>
          )}
        </div>
      ) : null}
      <div
        className={
          compact
            ? "grid h-full min-h-0 grid-cols-1 bg-slate-50 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]"
            : "space-y-3 p-3"
        }
      >
        <aside
          className={compact ? "min-h-0 overflow-auto border-r border-border bg-white p-4" : ""}
          aria-label="Parámetros de ejecución"
        >
          {compact ? (
            <div className="mb-4">
              <h2 className="font-bold">Parámetros</h2>
              <p className="text-xs text-muted">Valores utilizados al ejecutar el AST.</p>
            </div>
          ) : null}
          <QueryParametersPanel
            parameters={document.parameters}
            values={values}
            onChange={(id, value) => {
              setValues((current) => ({ ...current, [id]: value }));
            }}
          />
        </aside>
        <div className={compact ? "flex min-h-0 flex-col overflow-hidden p-4" : "space-y-3"}>
          {compact ? (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <h2 className="text-lg font-bold">Resultados</h2>
                <p className="text-xs text-muted">Ejecución segura desde el AST validado.</p>
              </div>
              {result ? <ExecutionSummary result={result} /> : null}
            </div>
          ) : null}
          {status === "executing" ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <LoaderCircle className="size-4 animate-spin" />
              Ejecutando consulta… El resultado anterior se conserva hasta finalizar.
            </div>
          ) : null}
          {error ? <div className="alert-error mb-3">{error}</div> : null}
          {result ? (
            <>
              {!compact ? <ExecutionSummary result={result} /> : null}
              <div className={compact ? "min-h-0 flex-1 overflow-hidden rounded-lg border" : ""}>
                <QueryResultsTable fill={compact} result={result} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted">
                  Página {page}
                  {totalPages ? ` de ${String(totalPages)}` : " · total no calculado"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary"
                    disabled={page <= 1 || status === "executing"}
                    onClick={() => {
                      void run(page - 1, pageSize);
                    }}
                  >
                    Anterior
                  </button>
                  <select
                    aria-label="Filas por página"
                    className="input w-24"
                    value={pageSize}
                    onChange={(event) => {
                      void run(1, Number(event.target.value));
                    }}
                  >
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                    <option>250</option>
                  </select>
                  <button
                    className="btn-secondary"
                    disabled={!result.execution.truncated || status === "executing"}
                    onClick={() => {
                      void run(page + 1, pageSize);
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid min-h-52 flex-1 place-items-center rounded-xl border border-dashed border-border bg-white p-8 text-center">
              <div>
                <Play className="mx-auto size-7 text-slate-400" />
                <p className="mt-2 font-semibold">Aún no hay resultados</p>
                <p className="mt-1 text-sm text-muted">
                  Completa los parámetros y usa Ejecutar en la barra superior.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SqlExecutionView({
  compilation,
  document,
  values,
  onChange,
  error,
  compiling,
  onCompile,
}: {
  compilation: CompilationResult | null;
  document: QueryDocument;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  error: string | null;
  compiling: boolean;
  onCompile?: () => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col border-r border-border">
        <header className="flex min-h-14 items-center gap-3 border-b border-border px-4">
          <div className="mr-auto">
            <h2 className="font-bold">SQL compilado</h2>
            <p className="text-xs text-muted">
              Solo lectura · generado por el backend desde el AST
            </p>
          </div>
          {compilation ? (
            <button
              className="btn-secondary min-h-8 px-2 py-1 text-xs"
              onClick={() => void navigator.clipboard.writeText(compilation.sql)}
            >
              <Copy className="size-3.5" /> Copiar
            </button>
          ) : null}
          <button
            className="btn-secondary min-h-8 px-2 py-1 text-xs"
            disabled={compiling || !onCompile}
            onClick={onCompile}
          >
            <RotateCw className={`size-3.5 ${compiling ? "animate-spin" : ""}`} />
            {compiling ? "Compilando…" : "Recompilar"}
          </button>
        </header>
        {error ? <div className="alert-error m-3 mb-0">{error}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto bg-[#fbfcfe]">
          {compilation ? (
            <ol className="min-w-max py-4 font-mono text-[13px] leading-6 text-slate-800">
              {compilation.sql.split("\n").map((line, index) => (
                <li className="grid grid-cols-[3.25rem_1fr] px-4" key={`${String(index)}-${line}`}>
                  <span className="select-none border-r border-slate-200 pr-3 text-right text-slate-400">
                    {index + 1}
                  </span>
                  <code className="whitespace-pre pl-4">{line || " "}</code>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid h-full min-h-64 place-items-center p-8 text-center text-sm text-muted">
              <div>
                <Info className="mx-auto mb-2 size-6" />
                Compila la consulta desde Vista visual para obtener el SQL parametrizado.
              </div>
            </div>
          )}
        </div>
      </div>
      <aside className="min-h-0 overflow-auto bg-white p-5" aria-label="Configuración SQL">
        <section>
          <h3 className="text-sm font-bold">Parámetros</h3>
          <p className="mt-1 text-xs text-muted">Valores enviados de forma parametrizada.</p>
          <div className="mt-3">
            {document.parameters.length ? (
              <QueryParametersPanel
                compact
                parameters={document.parameters}
                values={values}
                onChange={onChange}
              />
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted">
                No hay parámetros.
              </p>
            )}
          </div>
        </section>
        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-bold">Opciones</h3>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input checked={document.query.limit != null} disabled readOnly type="checkbox" />
            Limitar resultados
          </label>
          <input
            aria-label="Límite de resultados"
            className="input mt-2"
            disabled
            value={document.query.limit ?? "Sin límite explícito"}
            readOnly
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input checked={document.query.unions.length > 0} disabled readOnly type="checkbox" />
            Usa consultas compuestas
          </label>
          <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            Estas opciones reflejan el AST. Se modifican desde Vista visual para conservar
            undo/redo.
          </p>
        </section>
      </aside>
    </section>
  );
}

function ExecutionSummary({ result }: { result: ExecutionResult }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <strong className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
        {result.execution.status}
      </strong>
      <span className="rounded-full bg-slate-100 px-2 py-1">
        {result.execution.returned_row_count} filas
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-1">
        {result.execution.duration_ms ?? 0} ms
      </span>
      {result.execution.truncated ? (
        <strong className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">Truncado</strong>
      ) : null}
    </div>
  );
}

export interface QueryExecutionState {
  canRun: boolean;
  hasResult: boolean;
  status: "idle" | "executing" | "failed" | "cancelling";
}
