import { useMemo, useState } from "react";

import { Button } from "../../../../components/ui/Button";
import type { QueryBody, QueryExpression } from "../../../queries/types";
import { uniqueId } from "../../state";
import { useSavedSubqueryOptions } from "../../select-expressions/hooks/useSavedSubqueryOptions";
import { buildSubqueryPredicate, type SubqueryFilterKind } from "../model/predicates";
import type { FilterFieldOption } from "../model/types";
import { FilterFieldSelector } from "./FilterFieldSelector";
import { SubqueryWhereEditor } from "./SubqueryWhereEditor";

export function FilterSubqueryEditor({
  connectionId,
  scopeId,
  fields,
  initialNode,
  onCancel,
  onCommit,
}: {
  connectionId: string;
  scopeId: string;
  fields: FilterFieldOption[];
  initialNode?: QueryExpression | null;
  onCancel: () => void;
  onCommit: (predicate: QueryExpression) => void;
}) {
  const initial = useMemo(() => parseInitial(initialNode, fields), [fields, initialNode]);
  const [kind, setKind] = useState<SubqueryFilterKind>(initial.kind);
  const [fieldKey, setFieldKey] = useState(initial.fieldKey);
  const [queryReference, setQueryReference] = useState(initial.query ? "embedded" : "");
  const [correlated, setCorrelated] = useState(false);
  const [outerFieldKey, setOuterFieldKey] = useState("");
  const [innerFieldKey, setInnerFieldKey] = useState("");
  const [whereDraftActive, setWhereDraftActive] = useState(false);
  const [additionalPredicates, setAdditionalPredicates] = useState<QueryExpression[]>([]);
  const selectedSavedId = queryReference.startsWith("saved:") ? queryReference.slice(6) : null;
  const saved = useSavedSubqueryOptions(connectionId, true, selectedSavedId);
  const selectedQuery =
    queryReference === "embedded" ? initial.query : saved.selected?.document.query;
  const innerFields = selectedQuery ? subqueryFields(selectedQuery) : [];
  const scalar = selectedQuery?.select.length === 1;
  const needsField = kind === "in" || kind === "not_in";
  const valid = Boolean(
    selectedQuery &&
      (!needsField || (fieldKey && scalar)) &&
      (!correlated || (outerFieldKey && innerFieldKey)) &&
      !whereDraftActive,
  );
  return (
    <div className="rounded-md border border-blue-300 bg-blue-50/30 p-3" data-subquery-draft>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold">
          Operador de subconsulta
          <select
            aria-label="Operador de subconsulta"
            className="field mt-1"
            onChange={(event) => {
              setKind(event.target.value as SubqueryFilterKind);
            }}
            value={kind}
          >
            <option value="in">IN</option>
            <option value="not_in">NOT IN</option>
            <option value="exists">EXISTS</option>
            <option value="not_exists">NOT EXISTS</option>
          </select>
        </label>
        {needsField ? (
          <label className="text-xs font-semibold">
            Campo comparado
            <FilterFieldSelector
              fields={fields}
              label="Campo comparado"
              onChange={setFieldKey}
              value={fieldKey}
            />
          </label>
        ) : (
          <div className="rounded-md bg-white/70 p-2 text-xs text-slate-600">
            EXISTS comprueba si la subconsulta devuelve al menos una fila.
          </div>
        )}
        <label className="text-xs font-semibold">
          Consulta guardada
          <select
            aria-label="Consulta guardada para filtro"
            className="field mt-1"
            onChange={(event) => {
              setQueryReference(event.target.value);
              setCorrelated(false);
              setOuterFieldKey("");
              setInnerFieldKey("");
              setWhereDraftActive(false);
              setAdditionalPredicates([]);
            }}
            value={queryReference}
          >
            <option value="">Selecciona una consulta…</option>
            {initial.query ? <option value="embedded">Subconsulta configurada</option> : null}
            {saved.options.map((item) => {
              const incompatible = needsField && item.document.query.select.length !== 1;
              return (
                <option disabled={incompatible} key={item.id} value={`saved:${item.id}`}>
                  {item.name}
                  {incompatible
                    ? ` · IN requiere 1 columna (tiene ${String(item.document.query.select.length)})`
                    : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-md bg-white/70 p-2 text-xs font-semibold">
          <input
            checked={correlated}
            disabled={!selectedQuery || queryReference === "embedded"}
            onChange={(event) => {
              setCorrelated(event.target.checked);
            }}
            type="checkbox"
          />
          Correlacionar con la consulta principal
        </label>
      </div>
      {correlated ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold">
            Campo principal
            <FilterFieldSelector
              fields={fields.filter((item) => !item.aggregate)}
              label="Campo principal de correlación"
              onChange={setOuterFieldKey}
              value={outerFieldKey}
            />
          </label>
          <label className="text-xs font-semibold">
            Campo de subconsulta
            <select
              aria-label="Campo interno de correlación"
              className="field mt-1"
              onChange={(event) => {
                setInnerFieldKey(event.target.value);
              }}
              value={innerFieldKey}
            >
              <option value="">Selecciona un campo…</option>
              {innerFields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {selectedQuery ? (
        <SubqueryWhereEditor
          connectionId={connectionId}
          onChange={(predicates, draftActive) => {
            setAdditionalPredicates(predicates);
            setWhereDraftActive(draftActive);
          }}
          parameters={saved.selected?.document.parameters ?? []}
          predicates={additionalPredicates}
          query={selectedQuery}
        />
      ) : null}
      {!valid ? (
        <p className="mt-2 text-xs text-red-700">
          {needsField && selectedQuery && !scalar
            ? "IN requiere una subconsulta que devuelva exactamente una columna."
            : "Completa la subconsulta y los campos requeridos."}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onCancel} size="sm" variant="ghost">
          Cancelar
        </Button>
        <Button
          disabled={!valid || saved.loading}
          onClick={() => {
            if (!selectedQuery) return;
            const field = fields.find((item) => item.id === fieldKey);
            const predicate =
              queryReference === "embedded" && initial.subquery
                ? wrapSubquery(kind, field, initial.subquery, additionalPredicates)
                : buildSubqueryPredicate({
                    kind,
                    field,
                    query: selectedQuery,
                    queryId: initial.queryId ?? uniqueId("subquery"),
                    outerField: correlated
                      ? fields.find((item) => item.id === outerFieldKey)
                      : undefined,
                    innerField: correlated
                      ? innerFields.find((item) => item.id === innerFieldKey)?.expression
                      : undefined,
                    outerScopeId: scopeId,
                    additionalPredicates,
                  });
            if (predicate) onCommit(predicate);
          }}
          size="sm"
        >
          Aplicar subconsulta
        </Button>
      </div>
    </div>
  );
}

function parseInitial(node: QueryExpression | null | undefined, fields: FilterFieldOption[]) {
  const exists = node?.node_type === "exists";
  const inPredicate = node?.node_type === "in" && node.subquery;
  const subquery = (
    exists ? node.query : inPredicate ? node.subquery : null
  ) as QueryExpression | null;
  const expression = inPredicate ? (node.expression as QueryExpression) : null;
  const kind: SubqueryFilterKind = exists
    ? node.negated
      ? "not_exists"
      : "exists"
    : node?.negated
      ? "not_in"
      : "in";
  return {
    kind,
    fieldKey:
      fields.find((item) => JSON.stringify(item.expression) === JSON.stringify(expression))?.id ??
      "",
    query: subquery?.node_type === "subquery" ? (subquery.query as QueryBody) : null,
    subquery: subquery?.node_type === "subquery" ? structuredClone(subquery) : null,
    queryId:
      subquery?.node_type === "subquery" && typeof subquery.query_id === "string"
        ? subquery.query_id
        : null,
  };
}

function wrapSubquery(
  kind: SubqueryFilterKind,
  field: FilterFieldOption | undefined,
  subquery: QueryExpression,
  additionalPredicates: QueryExpression[],
): QueryExpression | null {
  const nextSubquery = structuredClone(subquery);
  const query = nextSubquery.query as QueryBody;
  for (const predicate of additionalPredicates)
    query.where = appendInternalPredicate(query.where, predicate);
  if (kind === "exists" || kind === "not_exists")
    return {
      node_type: "exists",
      query: nextSubquery,
      negated: kind === "not_exists",
    };
  if (!field) return null;
  return {
    node_type: "in",
    expression: structuredClone(field.expression),
    values: null,
    subquery: nextSubquery,
    negated: kind === "not_in",
  };
}

function appendInternalPredicate(
  current: QueryExpression | null | undefined,
  predicate: QueryExpression,
): QueryExpression {
  if (!current) return structuredClone(predicate);
  if (
    current.node_type === "logical_group" &&
    current.operator === "and" &&
    Array.isArray(current.conditions)
  ) {
    const conditions: QueryExpression[] = [];
    for (const child of current.conditions)
      if (child && typeof child === "object") conditions.push(child as QueryExpression);
    return { ...current, conditions: [...conditions, structuredClone(predicate)] };
  }
  return {
    node_type: "logical_group",
    operator: "and",
    conditions: [structuredClone(current), structuredClone(predicate)],
  };
}

function subqueryFields(query: QueryBody) {
  const aliases = new Map(
    [query.source, ...query.joins.map((join) => join.source)].map((source) => [
      source.source_id,
      source.alias,
    ]),
  );
  return query.select.flatMap((item) =>
    item.expression.node_type === "field"
      ? [
          {
            id: `inner:${String(item.expression.source_id)}:${String(item.expression.field_id)}`,
            sourceId: String(item.expression.source_id),
            fieldId: String(item.expression.field_id),
            label: `${aliases.get(String(item.expression.source_id)) ?? "entidad"}.${item.label ?? String(item.expression.field_id)}`,
            searchText:
              `${aliases.get(String(item.expression.source_id)) ?? "entidad"} ${item.label ?? String(item.expression.field_id)}`.toLocaleLowerCase(),
            dataType: "unknown",
            expression: item.expression,
            aggregate: false,
            available: true,
          } satisfies FilterFieldOption,
        ]
      : [],
  );
}
