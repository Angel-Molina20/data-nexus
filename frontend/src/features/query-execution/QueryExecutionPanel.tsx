import { LoaderCircle, Play, RotateCw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { QueryDocument } from "../queries/types";
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
  return (
    <section className={compact ? "bg-white" : "border-t bg-white"} aria-live="polite">
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
      <div className="space-y-3 p-3">
        <QueryParametersPanel
          parameters={document.parameters}
          values={values}
          onChange={(id, value) => {
            setValues((current) => ({ ...current, [id]: value }));
          }}
        />
        {status === "executing" ? (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <LoaderCircle className="size-4 animate-spin" />
            Ejecutando consulta… El resultado anterior se conserva hasta finalizar.
          </div>
        ) : null}
        {error ? <div className="alert-error">{error}</div> : null}
        {result ? (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <strong className="text-emerald-700">{result.execution.status}</strong>
              <span>{result.execution.returned_row_count} filas</span>
              <span>{result.execution.duration_ms ?? 0} ms</span>
              <span>
                {result.metadata.database_engine} {result.metadata.database_version}
              </span>
              {result.execution.truncated ? (
                <strong className="text-amber-700">Resultado truncado</strong>
              ) : null}
            </div>
            <QueryResultsTable result={result} />
            <div className="flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                disabled={page <= 1 || status === "executing"}
                onClick={() => {
                  void run(page - 1, pageSize);
                }}
              >
                Anterior
              </button>
              <span className="text-xs">
                Página {page}
                {totalPages ? ` de ${String(totalPages)}` : " · total no calculado"}
              </span>
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
          </>
        ) : null}
      </div>
    </section>
  );
}

export interface QueryExecutionState {
  canRun: boolean;
  hasResult: boolean;
  status: "idle" | "executing" | "failed" | "cancelling";
}
