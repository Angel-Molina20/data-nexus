import type { SavedQuery } from "../../queries/types";
import type { ReportDraft } from "../model/reportEditor";
import { ReportColumnsEditor } from "../ReportColumnsEditor";
import { ReportParametersEditor } from "./ReportParametersEditor";

interface ReportEditorFormProps {
  draft: ReportDraft;
  isEditing: boolean;
  isSaving: boolean;
  isValid: boolean;
  queries: SavedQuery[];
  selectedQuery?: SavedQuery;
  onSave: () => void;
  onUpdate: (patch: Partial<ReportDraft>) => void;
  onUpdateParameter: (
    parameterId: string,
    patch: Partial<ReportDraft["parameterSettings"][string]>,
  ) => void;
}

export function ReportEditorForm({
  draft,
  isEditing,
  isSaving,
  isValid,
  queries,
  selectedQuery,
  onSave,
  onUpdate,
  onUpdateParameter,
}: ReportEditorFormProps) {
  return (
    <section className="space-y-6 rounded-xl border bg-white p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Nombre
          <input
            className="field"
            value={draft.name}
            onChange={(event) => {
              onUpdate({ name: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Consulta guardada
          <select
            className="field"
            disabled={isEditing}
            value={draft.queryId}
            onChange={(event) => {
              onUpdate({ queryId: event.target.value });
            }}
          >
            <option value="">Seleccionar…</option>
            {queries.map((query) => (
              <option key={query.id} value={query.id}>
                {query.name} · revisión {query.revision}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">
          Descripción
          <textarea
            className="field min-h-20"
            value={draft.description}
            onChange={(event) => {
              onUpdate({ description: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Título
          <input
            className="field"
            value={draft.title}
            onChange={(event) => {
              onUpdate({ title: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Subtítulo
          <input
            className="field"
            value={draft.subtitle}
            onChange={(event) => {
              onUpdate({ subtitle: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Orientación
          <select
            className="field"
            value={draft.orientation}
            onChange={(event) => {
              onUpdate({ orientation: event.target.value as ReportDraft["orientation"] });
            }}
          >
            <option value="portrait">Vertical</option>
            <option value="landscape">Horizontal</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Tamaño de página
          <select
            className="field"
            value={draft.pageSize}
            onChange={(event) => {
              onUpdate({ pageSize: event.target.value as ReportDraft["pageSize"] });
            }}
          >
            <option value="A4">A4</option>
            <option value="letter">Carta</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">
          Pie de página
          <input
            className="field"
            value={draft.footer}
            onChange={(event) => {
              onUpdate({ footer: event.target.value });
            }}
          />
        </label>
      </div>
      <ReportParametersEditor
        parameters={selectedQuery?.document.parameters ?? []}
        settings={draft.parameterSettings}
        onChange={onUpdateParameter}
      />
      <ReportColumnsEditor
        columns={draft.columns}
        onChange={(columns) => {
          onUpdate({ columns });
        }}
      />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!isValid || isSaving} onClick={onSave}>
          {isSaving ? "Guardando…" : "Guardar reporte"}
        </button>
      </div>
    </section>
  );
}
