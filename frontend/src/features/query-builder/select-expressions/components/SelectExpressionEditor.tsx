import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import type { QueryDocument, QueryExpression, QuerySelectItem } from "../../../queries/types";
import type { SchemaEntity } from "../../../schema/types";
import { uniqueId } from "../../state";
import { SubqueryWhereEditor } from "../../filters/components/SubqueryWhereEditor";
import { useSavedSubqueryOptions } from "../hooks/useSavedSubqueryOptions";
import { SELECT_FUNCTIONS, type SelectFunctionId } from "../model/expressionCatalog";

type EditorMode = "function" | "case" | "subquery";
type OperandSource = "field" | "literal" | "parameter" | "subquery";
interface OperandDraft {
  source: OperandSource;
  reference: string;
  literal: string;
}
interface InitialEditorState {
  mode: EditorMode;
  functionId: SelectFunctionId;
  argumentsDraft: OperandDraft[];
  subqueryId: string;
  caseField: string;
  caseOperator: string;
  caseExpected: string;
  caseThen: string;
  caseElse: string;
}

const operand = (): OperandDraft => ({ source: "field", reference: "", literal: "" });

export function SelectExpressionEditor({
  document,
  entities,
  open,
  onClose,
  onCommit,
  initialItem,
}: {
  document: QueryDocument;
  entities: Record<string, SchemaEntity>;
  open: boolean;
  onClose: () => void;
  onCommit: (item: QuerySelectItem) => void;
  initialItem?: QuerySelectItem | null;
}) {
  const initial = initialEditorState(initialItem);
  const [mode, setMode] = useState<EditorMode>(initial.mode);
  const [functionId, setFunctionId] = useState<SelectFunctionId>(initial.functionId);
  const [argumentsDraft, setArgumentsDraft] = useState<OperandDraft[]>(initial.argumentsDraft);
  const [alias, setAlias] = useState(initialItem?.alias ?? "");
  const [label, setLabel] = useState(initialItem?.label ?? "");
  const [caseField, setCaseField] = useState(initial.caseField);
  const [caseOperator, setCaseOperator] = useState(initial.caseOperator);
  const [caseExpected, setCaseExpected] = useState(initial.caseExpected);
  const [caseThen, setCaseThen] = useState(initial.caseThen);
  const [caseElse, setCaseElse] = useState(initial.caseElse);
  const [subqueryId, setSubqueryId] = useState(initial.subqueryId);
  const [correlated, setCorrelated] = useState(false);
  const [outerCorrelation, setOuterCorrelation] = useState("");
  const [innerCorrelation, setInnerCorrelation] = useState("");
  const [subqueryWherePredicates, setSubqueryWherePredicates] = useState<QueryExpression[]>([]);
  const [subqueryWhereDraftActive, setSubqueryWhereDraftActive] = useState(false);
  const savedSubqueries = useSavedSubqueryOptions(
    document.connection_id,
    open && mode === "subquery",
    subqueryId.startsWith("saved:") ? subqueryId.slice(6) : null,
  );
  const options = useMemo(() => expressionOptions(document, entities), [document, entities]);
  const subqueries = document.query.select.filter(
    (item) => item.expression.node_type === "subquery",
  );
  const selectedSavedQuery = savedSubqueries.selected?.document.query;
  const existingSubquery = subqueries.find(
    (item) => `existing:${item.select_id}` === subqueryId,
  )?.expression;
  const selectedSubqueryQuery =
    selectedSavedQuery ??
    (existingSubquery?.node_type === "subquery"
      ? (existingSubquery.query as QueryDocument["query"])
      : null);
  const innerFields = selectedSavedQuery
    ? selectedSavedQuery.select.flatMap((item) =>
        item.expression.node_type === "field"
          ? [
              {
                id: `inner:${String(item.expression.source_id)}:${String(item.expression.field_id)}`,
                label: `${sourceAlias(selectedSavedQuery, String(item.expression.source_id))}.${item.label ?? String(item.expression.field_id)}`,
                expression: item.expression,
              },
            ]
          : [],
      )
    : [];
  const definition = SELECT_FUNCTIONS.find((item) => item.id === functionId) ?? {
    id: "concat",
    label: "CONCAT",
    minimum: 2,
    maximum: 20,
  };
  const build = (): QueryExpression | null => {
    if (mode === "subquery") {
      if (subqueryWhereDraftActive) return null;
      if (subqueryId.startsWith("saved:") && savedSubqueries.selected) {
        const query = structuredClone(savedSubqueries.selected.document.query);
        const outer = options.get(outerCorrelation);
        const inner = innerFields.find((item) => item.id === innerCorrelation)?.expression;
        if (correlated && (!outer || !inner)) return null;
        const correlation =
          correlated && outer && inner
            ? {
                node_type: "outer_field",
                scope_id: document.query.scope_id,
                source_id: outer.source_id,
                field_id: outer.field_id,
              }
            : null;
        for (const predicate of subqueryWherePredicates)
          query.where = appendAnd(query.where, structuredClone(predicate));
        if (correlation)
          query.where = appendAnd(query.where, {
            node_type: "comparison",
            operator: "equals",
            left: structuredClone(inner),
            right: correlation,
          });
        return {
          node_type: "subquery",
          query_id:
            initialItem?.expression.node_type === "subquery"
              ? initialItem.expression.query_id
              : uniqueId("subquery"),
          query,
          correlation: correlation ? [correlation] : [],
        };
      }
      const expression = structuredClone(existingSubquery ?? null);
      if (expression?.node_type === "subquery") {
        const query = expression.query as QueryDocument["query"];
        for (const predicate of subqueryWherePredicates)
          query.where = appendAnd(query.where, structuredClone(predicate));
      }
      return expression;
    }
    if (mode === "case") {
      const field = options.get(caseField);
      if (!field || !caseExpected || !caseThen) return null;
      return {
        node_type: "case",
        branches: [
          {
            when: {
              node_type: "comparison",
              operator: caseOperator,
              left: field,
              right: literalExpression(caseExpected),
            },
            then: literalExpression(caseThen),
          },
        ],
        else_expression: literalExpression(caseElse),
      };
    }
    const args = argumentsDraft
      .map((item) => buildOperand(item, options, subqueries))
      .filter(Boolean);
    if (args.length !== argumentsDraft.length || args.length < definition.minimum) return null;
    if (functionId === "group_concat")
      return {
        node_type: "aggregate",
        aggregate: "group_concat",
        argument: args[0],
        distinct: false,
      };
    return { node_type: "function", function: functionId, arguments: args, options: {} };
  };
  const expression = build();
  return (
    <Modal
      description="Construye una expresión universal. El frontend no genera SQL."
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={!expression}
            onClick={() => {
              if (!expression) return;
              onCommit({
                select_id: initialItem?.select_id ?? uniqueId("expression"),
                item_type:
                  mode === "subquery"
                    ? "subquery"
                    : expression.node_type === "aggregate"
                      ? "aggregate"
                      : "expression",
                expression,
                alias: alias || null,
                label: label || expressionSummary(expression),
                hidden: false,
              });
              onClose();
            }}
          >
            {initialItem ? "Guardar expresión" : "Añadir a SELECT"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title={initialItem ? "Editar expresión" : "Añadir expresión"}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold">
          Tipo de expresión
          <select
            className="field mt-1"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as EditorMode);
            }}
          >
            <option value="function">Función</option>
            <option value="case">Condicional (IF / CASE)</option>
            <option value="subquery">Subconsulta existente</option>
          </select>
        </label>
        {mode === "function" ? (
          <FunctionEditor
            drafts={argumentsDraft}
            functionId={functionId}
            maximum={definition.maximum}
            minimum={definition.minimum}
            onDrafts={setArgumentsDraft}
            onFunction={(next) => {
              setFunctionId(next);
              const target = SELECT_FUNCTIONS.find((item) => item.id === next) ?? {
                id: "concat",
                label: "CONCAT",
                minimum: 2,
                maximum: 20,
              };
              setArgumentsDraft((current) =>
                Array.from(
                  { length: Math.max(target.minimum, Math.min(current.length, target.maximum)) },
                  (_, index) => current[index] ?? operand(),
                ),
              );
            }}
            options={options}
            parameters={document.parameters}
            subqueries={subqueries}
          />
        ) : null}
        {mode === "case" ? (
          <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
            <label className="text-xs font-semibold">
              Campo
              <select
                className="field mt-1"
                value={caseField}
                onChange={(event) => {
                  setCaseField(event.target.value);
                }}
              >
                <option value="">Selecciona…</option>
                {[...options.entries()].map(([id, value]) => (
                  <option key={id} value={id}>
                    {expressionSummary(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Condición
              <select
                className="field mt-1"
                value={caseOperator}
                onChange={(event) => {
                  setCaseOperator(event.target.value);
                }}
              >
                <option value="equals">Igual a</option>
                <option value="not_equals">Diferente de</option>
                <option value="greater_than">Mayor que</option>
                <option value="less_than">Menor que</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Valor esperado
              <input
                className="field mt-1"
                value={caseExpected}
                onChange={(event) => {
                  setCaseExpected(event.target.value);
                }}
              />
            </label>
            <label className="text-xs font-semibold">
              Entonces
              <input
                className="field mt-1"
                value={caseThen}
                onChange={(event) => {
                  setCaseThen(event.target.value);
                }}
              />
            </label>
            <label className="text-xs font-semibold">
              Si no
              <input
                className="field mt-1"
                value={caseElse}
                onChange={(event) => {
                  setCaseElse(event.target.value);
                }}
              />
            </label>
          </div>
        ) : null}
        {mode === "subquery" ? (
          <div className="grid gap-3">
            <label className="text-sm font-semibold">
              Subconsulta
              <select
                className="field mt-1"
                value={subqueryId}
                onChange={(event) => {
                  setSubqueryId(event.target.value);
                  setSubqueryWherePredicates([]);
                  setSubqueryWhereDraftActive(false);
                }}
              >
                <option value="">Selecciona una expresión existente…</option>
                {subqueries.length ? (
                  <optgroup label="Expresiones de esta consulta">
                    {subqueries.map((item) => (
                      <option key={item.select_id} value={`existing:${item.select_id}`}>
                        {item.label ?? item.alias ?? item.select_id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {savedSubqueries.options.length ? (
                  <optgroup label="Consultas guardadas compatibles">
                    {savedSubqueries.options.map((item) => (
                      <option
                        disabled={item.document.query.select.length !== 1}
                        key={item.id}
                        value={`saved:${item.id}`}
                      >
                        {item.name}
                        {item.document.query.select.length !== 1
                          ? ` · requiere 1 columna (tiene ${String(item.document.query.select.length)})`
                          : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {!subqueries.length && !savedSubqueries.options.length ? (
                <span className="mt-2 block text-xs font-normal text-amber-700">
                  No hay consultas guardadas compatibles ni subconsultas reutilizables.
                </span>
              ) : null}
            </label>
            {subqueryId.startsWith("saved:") && selectedSavedQuery ? (
              <div className="rounded-lg border bg-slate-50 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    checked={correlated}
                    onChange={(event) => {
                      setCorrelated(event.target.checked);
                    }}
                    type="checkbox"
                  />
                  Correlacionar con la consulta principal
                </label>
                {correlated ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold">
                      Campo principal
                      <select
                        className="field mt-1"
                        value={outerCorrelation}
                        onChange={(event) => {
                          setOuterCorrelation(event.target.value);
                        }}
                      >
                        <option value="">Selecciona…</option>
                        {[...options.entries()].map(([id, expression]) => (
                          <option key={id} value={id}>
                            {expressionSummary(expression)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold">
                      Campo de subconsulta
                      <select
                        className="field mt-1"
                        value={innerCorrelation}
                        onChange={(event) => {
                          setInnerCorrelation(event.target.value);
                        }}
                      >
                        <option value="">Selecciona…</option>
                        {innerFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Se añadirá: campo_subconsulta = campo_principal (outer reference).
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {selectedSubqueryQuery ? (
              <SubqueryWhereEditor
                connectionId={document.connection_id}
                onChange={(predicates, draftActive) => {
                  setSubqueryWherePredicates(predicates);
                  setSubqueryWhereDraftActive(draftActive);
                }}
                parameters={savedSubqueries.selected?.document.parameters ?? document.parameters}
                predicates={subqueryWherePredicates}
                query={selectedSubqueryQuery}
              />
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
          <label className="text-xs font-semibold">
            Etiqueta
            <input
              className="field mt-1"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
              placeholder="Nombre visible"
            />
          </label>
          <label className="text-xs font-semibold">
            Alias
            <input
              className="field mt-1"
              value={alias}
              onChange={(event) => {
                setAlias(event.target.value);
              }}
              placeholder="alias_resultado"
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function FunctionEditor({
  drafts,
  functionId,
  minimum,
  maximum,
  onDrafts,
  onFunction,
  options,
  parameters,
  subqueries,
}: {
  drafts: OperandDraft[];
  functionId: SelectFunctionId;
  minimum: number;
  maximum: number;
  onDrafts: (value: OperandDraft[]) => void;
  onFunction: (value: SelectFunctionId) => void;
  options: Map<string, QueryExpression>;
  parameters: QueryDocument["parameters"];
  subqueries: QuerySelectItem[];
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <label className="text-sm font-semibold">
        Función
        <select
          className="field mt-1"
          value={functionId}
          onChange={(event) => {
            onFunction(event.target.value as SelectFunctionId);
          }}
        >
          {SELECT_FUNCTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 space-y-3">
        {drafts.map((draft, index) => (
          <div
            className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-[9rem_1fr_auto]"
            key={index}
          >
            <select
              aria-label={`Origen del argumento ${String(index + 1)}`}
              className="field"
              value={draft.source}
              onChange={(event) => {
                onDrafts(
                  drafts.map((item, current) =>
                    current === index
                      ? { ...item, source: event.target.value as OperandSource, reference: "" }
                      : item,
                  ),
                );
              }}
            >
              <option value="field">Campo</option>
              <option value="literal">Valor</option>
              <option value="parameter">Parámetro</option>
              <option value="subquery">Subconsulta</option>
            </select>
            {draft.source === "literal" ? (
              <input
                aria-label={`Valor del argumento ${String(index + 1)}`}
                className="field"
                value={draft.literal}
                onChange={(event) => {
                  onDrafts(
                    drafts.map((item, current) =>
                      current === index ? { ...item, literal: event.target.value } : item,
                    ),
                  );
                }}
              />
            ) : (
              <select
                aria-label={`Argumento ${String(index + 1)}`}
                className="field"
                value={draft.reference}
                onChange={(event) => {
                  onDrafts(
                    drafts.map((item, current) =>
                      current === index ? { ...item, reference: event.target.value } : item,
                    ),
                  );
                }}
              >
                <option value="">Selecciona…</option>
                {draft.source === "field"
                  ? [...options.entries()].map(([id, expression]) => (
                      <option key={id} value={id}>
                        {expressionSummary(expression)}
                      </option>
                    ))
                  : null}
                {draft.source === "parameter"
                  ? parameters.map((item) => (
                      <option key={item.parameter_id} value={item.parameter_id}>
                        :{item.name}
                      </option>
                    ))
                  : null}
                {draft.source === "subquery"
                  ? subqueries.map((item) => (
                      <option key={item.select_id} value={item.select_id}>
                        {item.label ?? item.select_id}
                      </option>
                    ))
                  : null}
              </select>
            )}
            <button
              aria-label={`Eliminar argumento ${String(index + 1)}`}
              className="icon-button text-red-600"
              disabled={drafts.length <= minimum}
              onClick={() => {
                onDrafts(drafts.filter((_, current) => current !== index));
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      {drafts.length < maximum ? (
        <button
          className="btn-secondary mt-3"
          onClick={() => {
            onDrafts([...drafts, operand()]);
          }}
        >
          <Plus className="size-4" />
          Argumento
        </button>
      ) : null}
    </div>
  );
}

function expressionOptions(document: QueryDocument, entities: Record<string, SchemaEntity>) {
  const result = new Map<string, QueryExpression>();
  for (const source of [document.query.source, ...document.query.joins.map((item) => item.source)])
    for (const field of entities[source.entity_id]?.fields ?? [])
      if (field.is_active)
        result.set(`field:${source.source_id}:${field.id}`, {
          node_type: "field",
          source_id: source.source_id,
          field_id: field.id,
          semantic_name: `${source.alias}.${field.display_name}`,
        });
  return result;
}
function buildOperand(
  draft: OperandDraft,
  options: Map<string, QueryExpression>,
  subqueries: QuerySelectItem[],
): QueryExpression | null {
  if (draft.source === "field") return structuredClone(options.get(draft.reference) ?? null);
  if (draft.source === "literal") return draft.literal ? literalExpression(draft.literal) : null;
  if (draft.source === "parameter")
    return draft.reference ? { node_type: "parameter", parameter_id: draft.reference } : null;
  return structuredClone(
    subqueries.find((item) => item.select_id === draft.reference)?.expression ?? null,
  );
}
function literalExpression(value: string): QueryExpression {
  return { node_type: "literal", value_type: "string", value };
}
function expressionSummary(expression: QueryExpression): string {
  if (expression.node_type === "field")
    return scalarText(expression.semantic_name, scalarText(expression.field_id, "Campo"));
  if (expression.node_type === "parameter")
    return `:${scalarText(expression.parameter_id, "parámetro")}`;
  if (expression.node_type === "subquery")
    return `Subconsulta ${scalarText(expression.query_id, "")}`;
  if (expression.node_type === "function")
    return `${scalarText(expression.function, "función").toUpperCase()}(…)`;
  if (expression.node_type === "case") return "CASE … END";
  return scalarText(expression.value, expression.node_type);
}

function scalarText(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
}

function sourceAlias(body: QueryDocument["query"], sourceId: string): string {
  return (
    [body.source, ...body.joins.map((join) => join.source)].find(
      (source) => source.source_id === sourceId,
    )?.alias ?? "subquery"
  );
}

function appendAnd(
  current: QueryExpression | null | undefined,
  condition: QueryExpression,
): QueryExpression {
  if (!current) return condition;
  if (current.node_type === "logical_group" && current.operator === "and") {
    const conditions: QueryExpression[] = [];
    if (Array.isArray(current.conditions))
      for (const child of current.conditions)
        if (child && typeof child === "object") conditions.push(child as QueryExpression);
    return {
      ...current,
      conditions: [...conditions, condition],
    };
  }
  return { node_type: "logical_group", operator: "and", conditions: [current, condition] };
}

function initialEditorState(item?: QuerySelectItem | null): InitialEditorState {
  const expression = item?.expression;
  const functionEntry =
    expression?.node_type === "aggregate" && expression.aggregate === "group_concat"
      ? "group_concat"
      : expression?.node_type === "function" &&
          typeof expression.function === "string" &&
          SELECT_FUNCTIONS.some((entry) => entry.id === expression.function)
        ? (expression.function as SelectFunctionId)
        : "concat";
  const functionArguments =
    expression?.node_type === "aggregate" &&
    expression.aggregate === "group_concat" &&
    expression.argument
      ? [operandFromExpression(expression.argument)]
      : expression?.node_type === "function" && Array.isArray(expression.arguments)
        ? expression.arguments.map(operandFromExpression)
        : [operand(), operand()];
  const branch =
    expression?.node_type === "case" && Array.isArray(expression.branches)
      ? (expression.branches[0] as Record<string, unknown> | undefined)
      : undefined;
  const when = branch?.when as Record<string, unknown> | undefined;
  const left = when?.left as QueryExpression | undefined;
  return {
    mode:
      expression?.node_type === "subquery"
        ? "subquery"
        : expression?.node_type === "case"
          ? "case"
          : "function",
    functionId: functionEntry,
    argumentsDraft: functionArguments.length ? functionArguments : [operand(), operand()],
    subqueryId: expression?.node_type === "subquery" && item ? `existing:${item.select_id}` : "",
    caseField:
      left?.node_type === "field" ? `field:${String(left.source_id)}:${String(left.field_id)}` : "",
    caseOperator: typeof when?.operator === "string" ? when.operator : "equals",
    caseExpected: expressionLiteral(when?.right),
    caseThen: expressionLiteral(branch?.then),
    caseElse: expressionLiteral(expression?.else_expression),
  };
}

function operandFromExpression(value: unknown): OperandDraft {
  const expression = value as QueryExpression | undefined;
  if (expression?.node_type === "field")
    return {
      source: "field",
      reference: `field:${String(expression.source_id)}:${String(expression.field_id)}`,
      literal: "",
    };
  if (expression?.node_type === "parameter")
    return {
      source: "parameter",
      reference: scalarText(expression.parameter_id, ""),
      literal: "",
    };
  if (expression?.node_type === "literal")
    return { source: "literal", reference: "", literal: expressionLiteral(expression) };
  return operand();
}

function expressionLiteral(value: unknown): string {
  const expression = value as QueryExpression | undefined;
  return expression?.node_type === "literal" ? scalarText(expression.value, "") : "";
}
