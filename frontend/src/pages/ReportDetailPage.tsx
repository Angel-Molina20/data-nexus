import { Download, FileDown, Pencil, Play } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { QueryParametersPanel } from "../features/query-execution/QueryParametersPanel";
import { QueryResultsTable } from "../features/query-execution/QueryResultsTable";
import { getQuery } from "../services/queries";
import { exportReport, getReport, listReportExports, previewReport, publishReport, reportExportDownloadUrl } from "../services/reports";

const formatFileSize = (bytes: number) => `${new Intl.NumberFormat("es-EC").format(Math.ceil(bytes / 1024))} KB`;

export function ReportDetailPage() {
  const { reportId = "" } = useParams(); const client = useQueryClient(); const [values, setValues] = useState<Record<string, unknown>>({}); const [format, setFormat] = useState("csv");
  const report = useQuery({ queryKey: ["report", reportId], queryFn: () => getReport(reportId) });
  const query = useQuery({ queryKey: ["query", report.data?.query_id], queryFn: () => getQuery(report.data?.query_id ?? ""), enabled: Boolean(report.data) });
  const history = useQuery({ queryKey: ["report-exports", reportId], queryFn: () => listReportExports(reportId) });
  const preview = useMutation({ mutationFn: () => previewReport(reportId, values) });
  const exporting = useMutation({ mutationFn: () => exportReport(reportId, format, values), onSuccess: async () => client.invalidateQueries({ queryKey: ["report-exports", reportId] }) });
  const publish = useMutation({ mutationFn: () => publishReport(reportId), onSuccess: async () => client.invalidateQueries({ queryKey: ["report", reportId] }) });
  const missing = useMemo(() => query.data?.document.parameters.some((item) => item.required && values[item.parameter_id] === undefined) ?? false, [query.data, values]);
  if (report.isPending) return <PageContainer><p className="state-message">Cargando reporte…</p></PageContainer>;
  if (report.isError) return <PageContainer><p className="alert-error">No fue posible cargar el reporte.</p></PageContainer>;
  const item = report.data;
  return <PageContainer><PageHeader eyebrow="Reporte" title={item.configuration.header.title} description={item.configuration.header.subtitle ?? item.description ?? "Reporte reutilizable"} actions={<><Link className="btn-secondary" to={`/reports/${item.id}/edit`}><Pencil className="size-4" />Editar</Link>{item.status === "draft" ? <button className="btn-primary" onClick={() => { publish.mutate(); }}>Publicar</button> : null}</>} />{item.warnings.map((warning) => <p className="alert-warning" key={warning}>{warning}</p>)}<section className="space-y-4 rounded-xl border bg-white p-5"><div className="flex items-center gap-2"><StatusBadge variant={item.status === "published" ? "success" : "info"}>{item.status}</StatusBadge><span className="text-sm text-slate-500">Consulta revisión {item.query_revision} · {item.configuration.layout.orientation}</span></div>{query.data ? <QueryParametersPanel parameters={query.data.document.parameters} values={values} onChange={(id, value) => { setValues((current) => ({ ...current, [id]: value })); }} /> : null}<div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={missing || preview.isPending} onClick={() => { preview.mutate(); }}><Play className="size-4" />{preview.isPending ? "Preparando…" : "Vista previa"}</button><select aria-label="Formato de exportación" className="field max-w-32" value={format} onChange={(event) => { setFormat(event.target.value); }}><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option></select><button className="btn-primary" disabled={item.status !== "published" || missing || exporting.isPending} onClick={() => { exporting.mutate(); }}><FileDown className="size-4" />{exporting.isPending ? "Exportando…" : "Exportar"}</button></div>{preview.isError || exporting.isError ? <p className="alert-error">{preview.error?.message ?? exporting.error?.message}</p> : null}{preview.data ? <div><h2 className="mb-3 font-bold">Vista previa · muestra limitada</h2><QueryResultsTable result={{ execution: preview.data.execution, columns: preview.data.columns, rows: preview.data.rows, warnings: preview.data.warnings, metadata: { database_engine: "", database_version: null, compiled_sql: null } }} /></div> : null}</section><section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Historial de exportaciones</h2><div className="mt-3 space-y-2">{history.data?.items.map((entry) => <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm" key={entry.id}><StatusBadge variant={entry.status === "completed" ? "success" : "warning"}>{entry.status}</StatusBadge><strong>{entry.file_name}</strong><span>{entry.row_count} filas</span><span>{entry.file_size ? formatFileSize(entry.file_size) : "—"}</span><span className="ml-auto">{new Date(entry.created_at).toLocaleString()}</span>{entry.download_url ? <a className="btn-secondary" href={reportExportDownloadUrl(entry.id)}><Download className="size-4" />Descargar</a> : null}</div>)}{history.data?.items.length === 0 ? <p className="text-sm text-slate-500">No hay exportaciones todavía.</p> : null}</div></section></PageContainer>;
}
