import type { SavedQuery } from "../../queries/types";
import type { ParameterSettings } from "../model/reportEditor";

interface ReportParametersEditorProps {
  parameters: SavedQuery["document"]["parameters"];
  settings: ParameterSettings;
  onChange: (parameterId: string, patch: Partial<ParameterSettings[string]>) => void;
}

export function ReportParametersEditor({
  parameters,
  settings,
  onChange,
}: ReportParametersEditorProps) {
  if (parameters.length === 0) return null;
  return (
    <section>
      <h2 className="font-bold">Parámetros</h2>
      <p className="mt-1 text-sm text-slate-500">
        El tipo y obligatoriedad provienen de la consulta y no pueden cambiarse.
      </p>
      <div className="mt-3 space-y-2">
        {parameters.map((parameter) => {
          const current = settings[parameter.parameter_id] ?? {
            label: parameter.label,
            description: "",
            visible: true,
          };
          return (
            <div
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_1fr] md:items-center"
              key={parameter.parameter_id}
            >
              <input
                aria-label={`Mostrar parámetro ${parameter.label}`}
                checked={current.visible}
                type="checkbox"
                onChange={(event) => {
                  onChange(parameter.parameter_id, { visible: event.target.checked });
                }}
              />
              <label className="grid gap-1 text-sm">
                Etiqueta
                <input
                  className="field"
                  value={current.label}
                  onChange={(event) => {
                    onChange(parameter.parameter_id, { label: event.target.value });
                  }}
                />
              </label>
              <span className="text-sm text-slate-500">
                {parameter.data_type}
                {parameter.required ? " · obligatorio" : " · opcional"}
                {parameter.sensitive ? " · sensible" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
