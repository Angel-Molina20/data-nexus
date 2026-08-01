import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clipboard, PlayCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { compileSavedQuery, getCompilerCapabilities, getQuery } from "../services/queries";

export function QueryCompilePage() {
  const { id = "" } = useParams();
  const [copied, setCopied] = useState(false);
  const query = useQuery({ queryKey: ["query", id], queryFn: () => getQuery(id) });
  const capabilities = useQuery({
    queryKey: ["query-compiler-capabilities", query.data?.connection_id],
    queryFn: () => {
      if (!query.data) throw new Error("query-not-loaded");
      return getCompilerCapabilities(query.data.connection_id);
    },
    enabled: Boolean(query.data),
  });
  const compilation = useMutation({ mutationFn: () => compileSavedQuery(id), retry: false });
  if (query.isPending) return <PageContainer><p className="state-message">Cargando borrador…</p></PageContainer>;
  if (query.isError) return <PageContainer><p className="alert-error">No fue posible cargar el borrador.</p></PageContainer>;
  const result = compilation.data;
  return <PageContainer>
    <PageHeader eyebrow="Compilador MySQL" title={`Vista previa: ${query.data.name}`} description="Genera SQL parametrizado desde el AST validado, sin conectarse a MySQL ni ejecutar la consulta." actions={<Link className="btn-secondary" to={`/queries/${id}`}>Volver al detalle</Link>} />
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <StatusBadge variant={query.data.validation_status === "valid" ? "success" : "warning"}>{query.data.validation_status}</StatusBadge>
      {capabilities.data ? <><StatusBadge>{capabilities.data.engine}</StatusBadge><span className="text-sm text-slate-600">{capabilities.data.provider} · {capabilities.data.server_version ?? "versión desconocida"}</span></> : null}
      <button className="btn-primary ml-auto" disabled={query.data.validation_status !== "valid" || compilation.isPending} onClick={() => { compilation.mutate(); }}><PlayCircle className="size-4" />{compilation.isPending ? "Compilando…" : "Compilar vista previa"}</button>
    </div>
    {query.data.validation_status !== "valid" ? <p className="alert-error">La consulta debe validarse correctamente antes de compilar.</p> : null}
    {compilation.isError ? <p className="alert-error">No fue posible compilar. Revisa la validez, las relaciones y las capacidades de la conexión.</p> : null}
    {!result ? <section className="rounded-xl border border-dashed bg-white p-12 text-center"><PlayCircle className="mx-auto size-10 text-blue-600" /><h2 className="mt-3 font-semibold">Vista previa pendiente</h2><p className="mt-1 text-sm text-slate-500">La compilación trabaja únicamente con el catálogo local de PostgreSQL.</p></section> : <div className="space-y-5">
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Compilación completada.</strong> Esta es una vista previa. La consulta no fue ejecutada.</section>
      <section className="overflow-hidden rounded-xl border bg-white"><header className="flex items-center justify-between border-b px-5 py-3"><div><h2 className="font-semibold">SQL parametrizado</h2><p className="text-xs text-slate-500">{result.dialect} · compilador {result.compiler_version}</p></div><button className="btn-secondary" onClick={() => { void navigator.clipboard.writeText(result.sql); setCopied(true); }}><span className="sr-only">Copiar SQL parametrizado</span>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{copied ? "Copiado" : "Copiar"}</button></header><pre aria-label="SQL parametrizado de solo lectura" className="max-h-[560px] overflow-auto bg-slate-950 p-5 text-sm leading-6 text-sky-100"><code>{result.sql}</code></pre></section>
      <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Parámetros</h2>{Object.entries(result.parameters).length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin parámetros.</p> : <div className="mt-3 space-y-2">{Object.entries(result.parameters).map(([name, parameter]) => <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" key={name}><code>:{name}</code><span>{parameter.data_type} · {parameter.sensitive ? "valor protegido" : parameter.source}</span></div>)}</div>}</section><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Compilación</h2><dl className="detail-grid mt-3"><div><dt>Complejidad</dt><dd>{result.complexity.level} ({result.complexity.score})</dd></div><div><dt>Ejecutada</dt><dd>No</dd></div><div><dt>Capacidades</dt><dd>{result.capabilities_used.join(", ") || "Ninguna adicional"}</dd></div><div><dt>Fingerprint</dt><dd className="break-all font-mono text-xs">{result.compilation_fingerprint}</dd></div></dl></section></div>
      {result.warnings.map((warning) => <article className="rounded-xl border border-amber-200 bg-amber-50 p-4" key={warning.code}><strong>{warning.code}</strong><p className="text-sm">{warning.message}</p></article>)}
    </div>}
  </PageContainer>;
}
