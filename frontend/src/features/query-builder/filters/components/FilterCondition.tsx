import { ChevronDown, ChevronUp, Copy, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../../components/ui/Button";
import { DropdownMenu } from "../../../../components/ui/DropdownMenu";
import type { QueryExpression, QueryParameter } from "../../../queries/types";
import { FILTER_OPERATORS, getFilterOperator } from "../model/operators";
import { buildPredicate } from "../model/predicates";
import type { FilterDraft, FilterFieldOption } from "../model/types";
import { emptyFilterDraft } from "../model/types";
import { FilterConditionDraft } from "./FilterConditionDraft";
import { FilterSubqueryEditor } from "./FilterSubqueryEditor";

/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion -- QueryExpression is an intentionally recursive JSON contract; values are narrowed by node_type and rendered only as escaped text. */

export function FilterCondition({
  node,
  fields,
  parameters,
  readOnly,
  canMoveUp,
  canMoveDown,
  onReplace,
  onDuplicate,
  onDelete,
  onMove,
  focused,
  connectionId,
  scopeId,
}: {
  node: QueryExpression;
  fields: FilterFieldOption[];
  parameters: QueryParameter[];
  readOnly: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReplace: (node: QueryExpression) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  focused?: boolean;
  connectionId: string;
  scopeId: string;
}) {
  const parsed = useMemo(() => draftFromPredicate(node, fields), [fields, node]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(parsed?.draft ?? emptyFilterDraft());
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focused) return;
    root.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    root.current?.focus({ preventScroll: true });
  }, [focused]);
  const field = fields.find((item) => item.id === draft.fieldKey);
  const operator = getFilterOperator(draft.operatorId);
  const advanced = !parsed;
  const subqueryCondition =
    node.node_type === "exists" || (node.node_type === "in" && Boolean(node.subquery));
  if (editing && subqueryCondition)
    return (
      <FilterSubqueryEditor
        connectionId={connectionId}
        fields={fields}
        initialNode={node}
        onCancel={() => {
          setEditing(false);
        }}
        onCommit={(predicate) => {
          onReplace(predicate);
          setEditing(false);
        }}
        scopeId={scopeId}
      />
    );
  if (editing && field && operator)
    return (
      <FilterConditionDraft
        draft={draft}
        fields={fields}
        parameters={parameters}
        onCancel={() => {
          setDraft(parsed?.draft ?? emptyFilterDraft());
          setEditing(false);
        }}
        onChange={setDraft}
        onCommit={() => {
          const predicate = buildPredicate(draft, fields);
          if (predicate) {
            onReplace(predicate);
            setEditing(false);
          }
        }}
      />
    );
  return (
    <div
      className={`filter-condition flex min-w-0 flex-wrap items-center gap-2 rounded-md border px-2 py-2 ${focused ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200" : parsed?.missing ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-white"}`}
      data-filter-condition
      ref={root}
      tabIndex={-1}
    >
      <div className="min-w-0 flex-1 text-sm">
        {subqueryCondition ? (
          <>
            <strong>Condición con subconsulta</strong>
            <p className="text-xs text-slate-500">{advancedSummary(node)}</p>
          </>
        ) : advanced ? (
          <>
            <strong>Condición avanzada</strong>
            <p className="text-xs text-slate-500">
              {advancedSummary(node)} · Se conserva sin cambios.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-slate-800">{parsed.summary}</p>
            {parsed.missing ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-700">
                <TriangleAlert className="size-3.5" />
                El campo ya no está disponible.
              </p>
            ) : null}
          </>
        )}
      </div>
      {!readOnly ? (
        <>
          <Button
            disabled={advanced && !subqueryCondition}
            onClick={() => {
              setDraft(parsed?.draft ?? emptyFilterDraft());
              setEditing(true);
            }}
            size="sm"
            startIcon={<Pencil className="size-3.5" />}
            variant="ghost"
          >
            Editar
          </Button>
          <DropdownMenu
            items={[
              { label: "Duplicar", icon: <Copy className="size-4" />, onSelect: onDuplicate },
              {
                label: "Mover arriba",
                icon: <ChevronUp className="size-4" />,
                disabled: !canMoveUp,
                onSelect: () => {
                  onMove(-1);
                },
              },
              {
                label: "Mover abajo",
                icon: <ChevronDown className="size-4" />,
                disabled: !canMoveDown,
                onSelect: () => {
                  onMove(1);
                },
              },
              {
                label: "Eliminar",
                icon: <Trash2 className="size-4" />,
                danger: true,
                onSelect: onDelete,
              },
            ]}
            label="Acciones de condición"
          />
        </>
      ) : null}
    </div>
  );
}

function draftFromPredicate(
  node: QueryExpression,
  fields: FilterFieldOption[],
): { draft: FilterDraft; summary: string; missing: boolean } | null {
  let left: QueryExpression | undefined;
  let operatorId = "";
  let rights: QueryExpression[] = [];
  if (node.node_type === "comparison") {
    left = node.left as QueryExpression;
    operatorId = String(node.operator);
    rights = [node.right as QueryExpression];
  } else if (node.node_type === "is_null") {
    left = node.expression as QueryExpression;
    operatorId = node.negated ? "is_not_null" : "is_null";
  } else if (node.node_type === "between") {
    left = node.expression as QueryExpression;
    operatorId = node.negated ? "not_between" : "between";
    rights = [node.lower as QueryExpression, node.upper as QueryExpression];
  } else if (node.node_type === "in" && Array.isArray(node.values)) {
    left = node.expression as QueryExpression;
    operatorId = node.negated ? "not_in" : "in";
    rights = node.values as QueryExpression[];
  } else if (node.node_type === "like") {
    left = node.expression as QueryExpression;
    operatorId = node.negated ? "not_like" : "like";
    rights = [node.pattern as QueryExpression];
  } else return null;
  const field = fields.find((item) => JSON.stringify(item.expression) === JSON.stringify(left));
  const source =
    rights[0]?.node_type === "parameter"
      ? "parameter"
      : rights[0]?.node_type === "field"
        ? "field"
        : "literal";
  const values = rights.map((right) =>
    right.node_type === "literal" ? String(right.value ?? "") : "",
  );
  const rightField =
    rights[0]?.node_type === "field"
      ? fields.find((item) => JSON.stringify(item.expression) === JSON.stringify(rights[0]))
      : undefined;
  const definition = FILTER_OPERATORS.find((item) => item.id === operatorId);
  const label =
    field?.label ??
    `${String(left?.source_id ?? "?")}.${String(left?.field_id ?? "campo eliminado")}`;
  const valueLabel =
    source === "parameter"
      ? `:${String(rights[0]?.parameter_id ?? "?")}`
      : source === "field"
        ? (rightField?.label ?? "campo no disponible")
        : values.map((value) => `“${value}”`).join(", ");
  return {
    draft: {
      fieldKey: field?.id ?? "",
      operatorId,
      valueSource: source,
      values: values.length ? values : [""],
      parameterId: source === "parameter" ? String(rights[0]?.parameter_id ?? "") : "",
      rightFieldKey: rightField?.id ?? "",
    },
    summary: `${label} ${definition?.label ?? operatorId}${definition?.cardinality === "none" ? "" : ` ${valueLabel}`}`,
    missing: !field,
  };
}

function advancedSummary(node: QueryExpression) {
  if (node.node_type === "exists")
    return node.negated ? "NOT EXISTS (subconsulta)" : "EXISTS (subconsulta)";
  if (node.node_type === "in" && node.subquery)
    return node.negated ? "NOT IN (subconsulta)" : "IN (subconsulta)";
  return String(node.node_type).replaceAll("_", " ");
}
