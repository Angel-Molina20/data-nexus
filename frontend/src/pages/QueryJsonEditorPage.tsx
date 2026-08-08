import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import type { QueryDocument, ValidationResult } from "../features/queries/types";
import { ApiError } from "../shared/api/httpClient";
import {
  getQuery,
  normalizeQueryModel,
  updateQuery,
  validateSavedQuery,
} from "../features/queries/api/queriesApi";
import { routes } from "../app/router/routes";
import { useUnsavedChangesGuard } from "../shared/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "../components/navigation/UnsavedChangesDialog";

export function QueryJsonEditorPage() {
  const { id = "" } = useParams();
  const client = useQueryClient();
  const saved = useQuery({ queryKey: ["query", id], queryFn: () => getQuery(id) });
  const [text, setText] = useState("");
  const [baseline, setBaseline] = useState("");
  const [syntaxError, setSyntaxError] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  useEffect(() => {
    if (saved.data) {
      const document = JSON.stringify(saved.data.document, null, 2);
      setText(document);
      setBaseline(document);
    }
  }, [saved.data]);
  const unsaved = useUnsavedChangesGuard(Boolean(baseline) && text !== baseline);
  const parse = (): QueryDocument | null => {
    try {
      setSyntaxError("");
      return JSON.parse(text) as QueryDocument;
    } catch {
      setSyntaxError("El JSON no tiene una sintaxis válida.");
      return null;
    }
  };
  const validate = useMutation({
    mutationFn: async () => {
      const document = parse();
      if (!document || !saved.data) throw new Error("syntax");
      const latest = await getQuery(id);
      const hasLocalChanges = JSON.stringify(document) !== JSON.stringify(saved.data.document);
      if (hasLocalChanges && latest.revision !== saved.data.revision) {
        throw new ApiError("El borrador cambió en otra sesión.", "QUERY_REVISION_CONFLICT");
      }
      if (hasLocalChanges) {
        await updateQuery(id, { revision: latest.revision, document });
      }
      return validateSavedQuery(id);
    },
    onSuccess: async (value) => {
      setResult(value);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["query", id] }),
        client.invalidateQueries({ queryKey: ["queries"] }),
      ]);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "QUERY_REVISION_CONFLICT") {
        setSyntaxError("Conflicto: otra sesión modificó este borrador. Recarga antes de validar.");
      }
    },
  });
  const normalize = useMutation({
    mutationFn: async () => {
      const document = parse();
      if (!document) throw new Error("syntax");
      return normalizeQueryModel(document);
    },
    onSuccess: (value) => {
      setText(JSON.stringify(value.normalized_query, null, 2));
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const document = parse();
      if (!document || !saved.data) throw new Error("syntax");
      return updateQuery(id, { revision: saved.data.revision, document });
    },
    onSuccess: (value) => {
      client.setQueryData(["query", id], value);
      const document = JSON.stringify(value.document, null, 2);
      setText(document);
      setBaseline(document);
      void client.invalidateQueries({ queryKey: ["queries"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "QUERY_REVISION_CONFLICT")
        setSyntaxError("Conflicto: otra sesión modificó este borrador. Recarga antes de guardar.");
    },
  });
  if (saved.isPending)
    return (
      <PageContainer>
        <p className="state-message">Cargando editor…</p>
      </PageContainer>
    );
  if (saved.isError)
    return (
      <PageContainer>
        <p className="alert-error">No fue posible cargar el borrador.</p>
      </PageContainer>
    );
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Editor técnico"
        title={saved.data.name}
        description="Edita exclusivamente el AST JSON. Esta pantalla no acepta ni muestra SQL."
        backAction={{ fallback: routes.queries.detail(id), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Consultas", to: routes.queries.list() },
          { label: saved.data.name, to: routes.queries.detail(id) },
          { label: "Editor JSON" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-xl border bg-white p-5">
          <textarea
            aria-label="Documento JSON"
            className="min-h-[650px] w-full resize-y rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-500"
            spellCheck={false}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setResult(null);
            }}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn-primary"
              disabled={validate.isPending}
              onClick={() => {
                validate.mutate();
              }}
            >
              Validar
            </button>
            <button
              className="btn-secondary"
              disabled={normalize.isPending}
              onClick={() => {
                normalize.mutate();
              }}
            >
              Normalizar
            </button>
            <button
              className="btn-secondary"
              disabled={save.isPending}
              onClick={() => {
                save.mutate();
              }}
            >
              Guardar revisión {saved.data.revision}
            </button>
          </div>
          {syntaxError ? <p className="alert-error mt-4">{syntaxError}</p> : null}
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Resultado</h2>
            {!result ? (
              <p className="mt-2 text-sm text-slate-500">
                Valida el documento para ver referencias, complejidad e issues.
              </p>
            ) : (
              <>
                <p
                  className={`mt-3 font-semibold ${result.valid ? "text-emerald-700" : "text-red-700"}`}
                >
                  {result.valid ? "Documento válido" : "Documento inválido"}
                </p>
                <p className="mt-2 text-sm">
                  Complejidad: {result.complexity.level} ({result.complexity.score})
                </p>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">
                  {result.fingerprint}
                </p>
              </>
            )}
          </section>
          {result?.errors.map((issue) => (
            <article
              className="rounded-xl border border-red-200 bg-red-50 p-4"
              key={`${issue.code}-${issue.path}`}
            >
              <strong className="text-sm text-red-800">{issue.code}</strong>
              <p className="mt-1 text-sm text-red-700">{issue.message}</p>
              <code className="mt-2 block text-xs text-red-600">{issue.path}</code>
            </article>
          ))}
          {result?.warnings.map((issue) => (
            <article
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              key={`${issue.code}-${issue.path}`}
            >
              <strong className="text-sm text-amber-800">Advertencia</strong>
              <p className="mt-1 text-sm text-amber-700">{issue.message}</p>
              <code className="mt-2 block text-xs">{issue.path}</code>
            </article>
          ))}
        </aside>
      </div>
      <UnsavedChangesDialog
        onLeave={unsaved.leave}
        onStay={unsaved.stay}
        open={unsaved.isBlocked}
      />
    </PageContainer>
  );
}
