import type { QueryParameter } from "../queries/types";

export function QueryParametersPanel({ parameters, values, onChange }: { parameters: QueryParameter[]; values: Record<string, unknown>; onChange: (id: string, value: unknown) => void }) {
  if (!parameters.length) return null;
  return <fieldset className="grid gap-3 rounded-lg border bg-slate-50 p-3 md:grid-cols-2"><legend className="px-1 text-sm font-bold">Parámetros</legend>{parameters.map((parameter) => <label className="text-xs font-semibold text-slate-700" key={parameter.parameter_id}>{parameter.label}{parameter.required ? " *" : ""}<ParameterInput parameter={parameter} value={values[parameter.parameter_id]} onChange={(value) => { onChange(parameter.parameter_id, value); }} /><span className="block font-normal text-slate-500">{parameter.description}</span></label>)}</fieldset>;
}

function ParameterInput({ parameter, value, onChange }: { parameter: QueryParameter; value: unknown; onChange: (value: unknown) => void }) {
  if (parameter.data_type === "boolean") return <input className="ml-2" type="checkbox" checked={Boolean(value)} onChange={(event) => { onChange(event.target.checked); }} />;
  if (parameter.allowed_values?.length) return <select className="input mt-1" value={inputValue(value)} onChange={(event) => { onChange(event.target.value); }}><option value="">Selecciona…</option>{parameter.allowed_values.map((item) => <option key={String(item)} value={String(item)}>{String(item)}</option>)}</select>;
  const inputType = parameter.data_type === "date" ? "date" : parameter.data_type === "datetime" ? "datetime-local" : ["integer", "decimal", "float"].includes(parameter.data_type) ? "number" : parameter.sensitive ? "password" : "text";
  return <input className="input mt-1" type={inputType} value={inputValue(value)} onChange={(event) => { onChange(event.target.value); }} autoComplete={parameter.sensitive ? "off" : undefined} />;
}

function inputValue(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
