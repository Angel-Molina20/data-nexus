import { Plus, X } from "lucide-react";

import { Button } from "../../../../components/ui/Button";
import type { QueryParameter } from "../../../queries/types";
import { compatibleParameters } from "../model/predicates";
import type { FilterDraft, FilterFieldOption, FilterOperatorDefinition } from "../model/types";
import { FilterFieldSelector } from "./FilterFieldSelector";

export function FilterValueEditor({
  draft,
  field,
  fields,
  operator,
  parameters,
  onChange,
  disabled,
}: {
  draft: FilterDraft;
  field: FilterFieldOption;
  fields: FilterFieldOption[];
  operator: FilterOperatorDefinition;
  parameters: QueryParameter[];
  onChange: (draft: FilterDraft) => void;
  disabled?: boolean;
}) {
  if (operator.cardinality === "none") return null;
  const parametersForType = compatibleParameters(parameters, field.dataType);
  const sources = operator.valueSources;
  return (
    <div className="flex min-w-0 flex-[2] flex-wrap items-start gap-2">
      <select
        aria-label="Origen del valor"
        className="field min-h-9 w-32 py-1.5 text-sm"
        disabled={disabled}
        onChange={(event) => {
          onChange({
            ...draft,
            valueSource: event.target.value as FilterDraft["valueSource"],
            values: [""],
            parameterId: "",
            rightFieldKey: "",
          });
        }}
        value={draft.valueSource}
      >
        {sources.includes("literal") ? <option value="literal">Valor</option> : null}
        {sources.includes("parameter") ? <option value="parameter">Parámetro</option> : null}
        {sources.includes("field") ? <option value="field">Campo</option> : null}
      </select>
      {draft.valueSource === "parameter" ? (
        <select
          aria-label="Parámetro"
          className="field min-h-9 min-w-44 flex-1 py-1.5 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...draft, parameterId: event.target.value });
          }}
          value={draft.parameterId}
        >
          <option value="">Selecciona un parámetro…</option>
          {parametersForType.map((parameter) => (
            <option key={parameter.parameter_id} value={parameter.parameter_id}>
              :{parameter.name}
              {parameter.sensitive ? " · sensible" : ""}
            </option>
          ))}
        </select>
      ) : null}
      {draft.valueSource === "field" ? (
        <FilterFieldSelector
          disabled={disabled}
          fields={fields.filter(
            (item) =>
              item.dataType === field.dataType ||
              item.dataType === "unknown" ||
              field.dataType === "unknown",
          )}
          label="Campo de valor"
          onChange={(rightFieldKey) => {
            onChange({ ...draft, rightFieldKey });
          }}
          value={draft.rightFieldKey}
        />
      ) : null}
      {draft.valueSource === "literal" ? (
        <LiteralInputs
          disabled={disabled}
          draft={draft}
          field={field}
          operator={operator}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function LiteralInputs({
  draft,
  field,
  operator,
  onChange,
  disabled,
}: {
  draft: FilterDraft;
  field: FilterFieldOption;
  operator: FilterOperatorDefinition;
  onChange: (draft: FilterDraft) => void;
  disabled?: boolean;
}) {
  const count = operator.cardinality === "two" ? 2 : draft.values.length;
  const values = Array.from({ length: count }, (_, index) => draft.values[index] ?? "");
  const inputType =
    field.dataType === "date"
      ? "date"
      : field.dataType === "datetime"
        ? "datetime-local"
        : field.dataType === "time"
          ? "time"
          : field.dataType === "integer" || field.dataType === "decimal"
            ? "number"
            : "text";
  return (
    <div
      className={`min-w-48 flex-1 ${operator.cardinality === "many" ? "space-y-1" : "flex gap-2"}`}
    >
      {field.dataType !== "boolean"
        ? values.map((value, index) => (
            <div className="flex min-w-32 flex-1 items-center gap-1" key={index}>
              <input
                aria-label={
                  operator.cardinality === "two"
                    ? index === 0
                      ? "Desde"
                      : "Hasta"
                    : `Valor ${String(index + 1)}`
                }
                className="field min-h-9 py-1.5 text-sm"
                disabled={disabled}
                inputMode={field.dataType === "decimal" ? "decimal" : undefined}
                step={
                  field.dataType === "integer"
                    ? "1"
                    : field.dataType === "decimal"
                      ? "any"
                      : undefined
                }
                type={field.dataType === "boolean" ? "text" : inputType}
                value={value}
                onChange={(event) => {
                  const next = [...draft.values];
                  next[index] = event.target.value;
                  onChange({ ...draft, values: next });
                }}
                placeholder={
                  operator.cardinality === "two" ? (index === 0 ? "Desde" : "Hasta") : "Valor"
                }
              />
              {operator.cardinality === "many" && values.length > 1 ? (
                <button
                  aria-label={`Eliminar valor ${String(index + 1)}`}
                  className="icon-button"
                  disabled={disabled}
                  onClick={() => {
                    onChange({ ...draft, values: draft.values.filter((_, at) => at !== index) });
                  }}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))
        : null}
      {field.dataType === "boolean" ? (
        <select
          aria-label="Valor booleano"
          className="field min-h-9 py-1.5 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...draft, values: [event.target.value] });
          }}
          value={draft.values[0] ?? ""}
        >
          <option value="">Selecciona…</option>
          <option value="true">Verdadero</option>
          <option value="false">Falso</option>
        </select>
      ) : null}
      {operator.cardinality === "many" ? (
        <Button
          disabled={disabled}
          onClick={() => {
            onChange({ ...draft, values: [...draft.values, ""] });
          }}
          size="sm"
          startIcon={<Plus className="size-3" />}
          variant="ghost"
        >
          Otro valor
        </Button>
      ) : null}
    </div>
  );
}
