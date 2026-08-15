import { Button } from "../../../../components/ui/Button";
import type { QueryParameter } from "../../../queries/types";
import { getFilterOperator, operatorsForType } from "../model/operators";
import { buildPredicate } from "../model/predicates";
import type { FilterDraft, FilterFieldOption } from "../model/types";
import { FilterFieldSelector } from "./FilterFieldSelector";
import { FilterValueEditor } from "./FilterValueEditor";

export function FilterConditionDraft({
  draft,
  fields,
  parameters,
  onChange,
  onCommit,
  onCancel,
}: {
  draft: FilterDraft;
  fields: FilterFieldOption[];
  parameters: QueryParameter[];
  onChange: (draft: FilterDraft) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const field = fields.find((item) => item.id === draft.fieldKey);
  const operators = field ? operatorsForType(field.dataType) : [];
  const operator = getFilterOperator(draft.operatorId);
  const valid = Boolean(buildPredicate(draft, fields));
  return (
    <div className="rounded-md border border-blue-300 bg-blue-50/30 p-2" data-filter-draft>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <FilterFieldSelector
          fields={fields}
          onChange={(fieldKey) => {
            const nextField = fields.find((item) => item.id === fieldKey);
            const nextOperators = nextField ? operatorsForType(nextField.dataType) : [];
            const retained = nextOperators.some((item) => item.id === draft.operatorId)
              ? draft.operatorId
              : (nextOperators[0]?.id ?? "");
            onChange({
              ...draft,
              fieldKey,
              operatorId: retained,
              values: [""],
              parameterId: "",
              rightFieldKey: "",
            });
          }}
          value={draft.fieldKey}
        />
        <select
          aria-label="Operador"
          className="field min-h-9 min-w-48 flex-1 py-1.5 text-sm"
          disabled={!field}
          onChange={(event) => {
            const next = getFilterOperator(event.target.value);
            onChange({
              ...draft,
              operatorId: event.target.value,
              valueSource: next?.valueSources[0] ?? "literal",
              values: next?.cardinality === "two" ? ["", ""] : [""],
              parameterId: "",
              rightFieldKey: "",
            });
          }}
          value={draft.operatorId}
        >
          <option value="">Selecciona un operador…</option>
          {operators.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {field && operator ? (
          <FilterValueEditor
            draft={draft}
            field={field}
            fields={fields}
            onChange={onChange}
            operator={operator}
            parameters={parameters}
          />
        ) : null}
      </div>
      {!valid ? (
        <p className="mt-2 text-xs text-red-700">
          Completa el campo, operador y los valores requeridos.
        </p>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onCancel} size="sm" variant="ghost">
          Cancelar
        </Button>
        <Button disabled={!valid} onClick={onCommit} size="sm">
          Aplicar condición
        </Button>
      </div>
    </div>
  );
}
