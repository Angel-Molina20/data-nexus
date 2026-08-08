import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportColumnsEditor } from "../features/reports/ReportColumnsEditor";
import type { ReportColumn, ReportConfiguration } from "../features/reports/types";
import { listQueries } from "../services/queries";
import { createReport, getReport, updateReport } from "../services/reports";

type ParameterSettings = Record<string, { label: string; description: string; visible: boolean; default_value?: unknown }>;

const automaticFormat = () => ({
  type: "automatic",
  null_label: "NULL",
  true_label: "Sí",
  false_label: "No",
});

export function ReportEditorPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(reportId);
  const queries = useQuery({ queryKey: ["queries"], queryFn: listQueries });
  const report = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId ?? ""),
    enabled: editing,
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [queryId, setQueryId] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [pageSize, setPageSize] = useState<"A4" | "letter">("A4");
  const [footer, setFooter] = useState("");
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [parameterSettings, setParameterSettings] = useState<ParameterSettings>({});
  const selected = useMemo(
    () => queries.data?.items.find((item) => item.id === queryId),
    [queries.data, queryId],
  );

  useEffect(() => {
    if (!selected || (editing && report.data)) return;
    setColumns(selected.document.query.select.map((item, position) => ({
      source_key: item.alias ?? item.label ?? item.select_id,
      label: item.label ?? item.alias ?? item.select_id,
      visible: !item.hidden,
      position,
      alignment: "left",
      format: automaticFormat(),
    })));
    setParameterSettings(Object.fromEntries(selected.document.parameters.map((parameter) => [
      parameter.parameter_id,
      {
        label: parameter.label,
        description: parameter.description ?? "",
        visible: true,
        ...(parameter.default_value !== undefined ? { default_value: parameter.default_value } : {}),
      },
    ])));
  }, [editing, report.data, selected]);

  useEffect(() => {
    if (!report.data) return;
    setName(report.data.name);
    setDescription(report.data.description ?? "");
    setQueryId(report.data.query_id);
    setTitle(report.data.configuration.header.title);
    setSubtitle(report.data.configuration.header.subtitle ?? "");
    setOrientation(report.data.configuration.layout.orientation);
    setPageSize(report.data.configuration.layout.page_size);
    setFooter(report.data.configuration.footer.text);
    setColumns(report.data.configuration.columns);
    setParameterSettings(report.data.configuration.parameters as ParameterSettings);
  }, [report.data]);

  const configuration = (): ReportConfiguration => ({
    version: 1,
    layout: {
      orientation,
      page_size: pageSize,
      show_generated_at: true,
      show_page_numbers: true,
    },
    header: { title, subtitle: subtitle || null, description: description || null },
    columns,
    footer: { text: footer, show_row_count: true },
    locale: "es-EC",
    timezone: "America/Guayaquil",
    parameters: parameterSettings,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecciona una consulta");
      const payload = { name, description: description || null, configuration: configuration() };
      return editing
        ? updateReport(reportId ?? "", payload)
        : createReport({
            ...payload,
            query_id: selected.id,
            query_revision: selected.revision,
          });
    },
    onSuccess: (value) => { void navigate(`/reports/${value.id}`); },
  });
  const valid = Boolean(name.trim() && title.trim() && selected && columns.some((item) => item.visible));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Editor de reportes"
        title={editing ? "Editar reporte" : "Nuevo reporte"}
        description="La definición queda fijada a una revisión de consulta y una instantánea del AST."
      />
      <section className="space-y-6 rounded-xl border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Nombre
            <input className="field" value={name} onChange={(event) => { setName(event.target.value); }} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Consulta guardada
            <select className="field" disabled={editing} value={queryId} onChange={(event) => { setQueryId(event.target.value); }}>
              <option value="">Seleccionar…</option>
              {queries.data?.items.map((query) => (
                <option key={query.id} value={query.id}>{query.name} · revisión {query.revision}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold md:col-span-2">
            Descripción
            <textarea className="field min-h-20" value={description} onChange={(event) => { setDescription(event.target.value); }} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Título
            <input className="field" value={title} onChange={(event) => { setTitle(event.target.value); }} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Subtítulo
            <input className="field" value={subtitle} onChange={(event) => { setSubtitle(event.target.value); }} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Orientación
            <select className="field" value={orientation} onChange={(event) => { setOrientation(event.target.value as "portrait" | "landscape"); }}>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Tamaño de página
            <select className="field" value={pageSize} onChange={(event) => { setPageSize(event.target.value as "A4" | "letter"); }}>
              <option value="A4">A4</option>
              <option value="letter">Carta</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold md:col-span-2">
            Pie de página
            <input className="field" value={footer} onChange={(event) => { setFooter(event.target.value); }} />
          </label>
        </div>
        {selected?.document.parameters.length ? (
          <section>
            <h2 className="font-bold">Parámetros</h2>
            <p className="mt-1 text-sm text-slate-500">El tipo y obligatoriedad provienen de la consulta y no pueden cambiarse.</p>
            <div className="mt-3 space-y-2">
              {selected.document.parameters.map((parameter) => {
                const settings = parameterSettings[parameter.parameter_id] ?? {
                  label: parameter.label,
                  description: "",
                  visible: true,
                };
                return (
                  <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_1fr] md:items-center" key={parameter.parameter_id}>
                    <input
                      aria-label={`Mostrar parámetro ${parameter.label}`}
                      checked={settings.visible}
                      type="checkbox"
                      onChange={(event) => { setParameterSettings((current) => ({ ...current, [parameter.parameter_id]: { ...settings, visible: event.target.checked } })); }}
                    />
                    <label className="grid gap-1 text-sm">Etiqueta<input className="field" value={settings.label} onChange={(event) => { setParameterSettings((current) => ({ ...current, [parameter.parameter_id]: { ...settings, label: event.target.value } })); }} /></label>
                    <span className="text-sm text-slate-500">{parameter.data_type}{parameter.required ? " · obligatorio" : " · opcional"}{parameter.sensitive ? " · sensible" : ""}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        <ReportColumnsEditor columns={columns} onChange={setColumns} />
        {save.isError ? <p className="alert-error">No fue posible guardar el reporte.</p> : null}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => { save.mutate(); }}>
            {save.isPending ? "Guardando…" : "Guardar reporte"}
          </button>
        </div>
      </section>
    </PageContainer>
  );
}
