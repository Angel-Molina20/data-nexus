import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  EyeOff,
  Link2,
  MousePointer2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  QueryDocument,
  QueryExpression,
  QueryParameter,
  QuerySelectItem,
} from "../queries/types";
import type { SchemaEntity } from "../schema/types";
import { canonical, queryActions, requiresGroupBy, uniqueId, type BuilderTab } from "./state";
import { SelectExpressionEditor } from "./select-expressions/components/SelectExpressionEditor";

/* eslint-disable @typescript-eslint/restrict-template-expressions -- recursive expressions are backend-schema validated */

interface EditorProps {
  document: QueryDocument;
  readOnly: boolean;
  onChange: (next: QueryDocument) => void;
}
const labels: Record<BuilderTab, string> = {
  fields: "Campos",
  grouping: "Agrupar",
  order: "Orden",
  parameters: "Parámetros",
  unions: "UNION",
};
const fieldExpression = (sourceId: string, fieldId: string): QueryExpression => ({
  node_type: "field",
  source_id: sourceId,
  field_id: fieldId,
});
const expressionLabel = (expression: QueryExpression, index: number): string => {
  if (expression.node_type === "function")
    return `${typeof expression.function === "string" ? expression.function.toUpperCase() : "FUNCIÓN"}(...)`;
  if (expression.node_type === "subquery")
    return `Subconsulta ${typeof expression.query_id === "string" ? expression.query_id.slice(0, 12) : String(index + 1)}`;
  if (expression.node_type === "case") return "Condicional CASE";
  return `Expresión ${String(index + 1)}`;
};
const selectedFields = (document: QueryDocument) => {
  const sourceAliases = new Map(
    [document.query.source, ...document.query.joins.map((join) => join.source)].map((source) => [
      source.source_id,
      source.alias,
    ]),
  );
  return document.query.select
    .filter((item) => item.expression.node_type === "field")
    .map((item) => ({
      key: `${item.expression.source_id}:${item.expression.field_id}`,
      sourceId: String(item.expression.source_id),
      fieldId: String(item.expression.field_id),
      label: `${sourceAliases.get(String(item.expression.source_id)) ?? "entidad"}.${item.label ?? String(item.expression.field_id)}`,
    }));
};

export function QueryInspectorPanel({
  document,
  tab,
  readOnly,
  onTab,
  onChange,
  entities,
  selectedJoinId,
  selectedSourceId,
}: EditorProps & {
  entities: Record<string, SchemaEntity>;
  selectedJoinId: string | null;
  selectedSourceId: string | null;
  tab: BuilderTab;
  onTab: (tab: BuilderTab) => void;
}) {
  const tabs: BuilderTab[] = ["fields", "grouping", "order", "parameters", "unions"];
  const source = [document.query.source, ...document.query.joins.map((join) => join.source)].find(
    (item) => item.source_id === selectedSourceId,
  );
  const join = document.query.joins.find((item) => item.join_id === selectedJoinId);
  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-white" aria-label="Inspector">
      <div className="border-b px-3 py-2.5">
        <h2 className="text-sm font-semibold">Inspector</h2>
        {source ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Entidad · {entities[source.entity_id]?.display_name ?? source.alias}
          </p>
        ) : join ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Relación · {join.join_type.toUpperCase()} · {join.source.alias}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-slate-500">Contexto de la selección actual</p>
        )}
      </div>
      {!source && !join ? (
        <div className="grid min-h-0 flex-1 place-items-center p-5 text-center">
          <div>
            <MousePointer2 className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-sm font-semibold">Sin selección</p>
            <p className="mt-1 text-xs text-slate-500">
              Selecciona una entidad o relación para ver sus propiedades.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b bg-slate-50 p-3">
            <label className="block text-xs font-semibold text-slate-600">
              Sección del inspector
              <select
                className="field mt-1 min-h-9 bg-white py-1.5 text-sm"
                onChange={(event) => {
                  onTab(event.target.value as BuilderTab);
                }}
                value={tab}
              >
                {tabs.map((item) => (
                  <option key={item} value={item}>
                    {labels[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "fields" ? (
              <Fields
                document={document}
                entities={entities}
                readOnly={readOnly}
                onChange={onChange}
              />
            ) : null}
            {tab === "grouping" ? (
              <Grouping
                document={document}
                entities={entities}
                readOnly={readOnly}
                onChange={onChange}
              />
            ) : null}
            {tab === "order" ? (
              <Ordering document={document} readOnly={readOnly} onChange={onChange} />
            ) : null}
            {tab === "parameters" ? (
              <Parameters document={document} readOnly={readOnly} onChange={onChange} />
            ) : null}
            {tab === "unions" ? (
              <Unions document={document} readOnly={readOnly} onChange={onChange} />
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}

function Fields({
  document,
  entities,
  readOnly,
  onChange,
}: EditorProps & { entities: Record<string, SchemaEntity> }) {
  const [joinsExpanded, setJoinsExpanded] = useState(false);
  const [expressionEditorItem, setExpressionEditorItem] = useState<QuerySelectItem | "new" | null>(
    null,
  );
  return (
    <section>
      <h2 className="font-semibold">Entidades y joins</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex min-h-11 items-center gap-2 border-b border-slate-100 bg-white px-3">
          <Database className="size-4 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm">{document.query.source.alias}</strong>
            <span className="block truncate text-[11px] text-slate-500">Entidad principal</span>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            BASE
          </span>
        </div>
        <button
          aria-expanded={joinsExpanded}
          className="flex min-h-10 w-full items-center gap-2 bg-slate-50 px-3 text-left hover:bg-slate-100"
          onClick={() => {
            setJoinsExpanded((value) => !value);
          }}
          type="button"
        >
          {joinsExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <Link2 className="size-3.5 text-slate-500" />
          <strong className="flex-1 text-xs">Relaciones</strong>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {document.query.joins.length}
          </span>
        </button>
        {joinsExpanded ? (
          document.query.joins.length ? (
            <div className="divide-y divide-slate-100">
              {document.query.joins.map((join) => (
                <div className="flex min-h-10 items-center gap-2 px-3" key={join.join_id}>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">{join.source.alias}</strong>
                    <span className="block truncate text-[10px] text-slate-500">
                      {join.join_type.toUpperCase()} ·{" "}
                      {join.polymorphic_mapping_id
                        ? "Polimórfica"
                        : join.relationship_id
                          ? "Catálogo"
                          : "Manual"}
                    </span>
                  </div>
                  <button
                    aria-label={`Quitar join ${join.source.alias}`}
                    className="icon-button size-7 text-red-600"
                    disabled={readOnly}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `¿Quitar el join con ${join.source.alias}? También se quitarán sus campos, filtros, agrupaciones y ordenamientos dependientes.`,
                      );
                      if (confirmed) onChange(queryActions.removeJoin(document, join.join_id));
                    }}
                    title="Quitar join de la consulta"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-slate-400">No hay relaciones en esta consulta.</p>
          )
        ) : null}
      </div>
      <h2 className="mt-6 font-semibold">Campos seleccionados</h2>
      <p className="mt-1 text-xs text-slate-500">El orden define las columnas resultantes.</p>
      <button
        className="btn-secondary mt-3 w-full"
        disabled={readOnly}
        onClick={() => {
          setExpressionEditorItem("new");
        }}
      >
        <Plus className="size-4" />
        Añadir expresión
      </button>
      <SelectedFieldGroups
        document={document}
        onChange={onChange}
        onEditExpression={setExpressionEditorItem}
        readOnly={readOnly}
      />
      {expressionEditorItem ? (
        <SelectExpressionEditor
          document={document}
          entities={entities}
          initialItem={expressionEditorItem === "new" ? null : expressionEditorItem}
          onClose={() => {
            setExpressionEditorItem(null);
          }}
          onCommit={(item) => {
            onChange(
              queryActions.update(document, (draft) => {
                const index = draft.query.select.findIndex(
                  (entry) => entry.select_id === item.select_id,
                );
                if (index >= 0) draft.query.select[index] = item;
                else draft.query.select.push(item);
              }),
            );
          }}
          open
        />
      ) : null}
    </section>
  );
}

function SelectedFieldGroups({
  document,
  readOnly,
  onChange,
  onEditExpression,
}: EditorProps & { onEditExpression: (item: QuerySelectItem) => void }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const sourceLabels = useMemo(
    () =>
      new Map(
        [document.query.source, ...document.query.joins.map((join) => join.source)].map(
          (source) => [source.source_id, source.alias],
        ),
      ),
    [document.query.joins, document.query.source],
  );
  const groups = useMemo(() => {
    const result = new Map<
      string,
      Array<{ item: QueryDocument["query"]["select"][number]; index: number }>
    >();
    document.query.select.forEach((item, index) => {
      const sourceId =
        item.expression.node_type === "field" && typeof item.expression.source_id === "string"
          ? item.expression.source_id
          : "expressions";
      const current = result.get(sourceId) ?? [];
      current.push({ item, index });
      result.set(sourceId, current);
    });
    return [...result.entries()];
  }, [document.query.select]);
  const toggle = (setter: (value: Set<string>) => void, current: Set<string>, id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };
  return (
    <div className="mt-3 space-y-2">
      {groups.map(([sourceId, items]) => {
        const expanded = expandedGroups.has(sourceId);
        const groupLabel = sourceLabels.get(sourceId) ?? "Expresiones y agregaciones";
        return (
          <section className="overflow-hidden rounded-lg border border-slate-200" key={sourceId}>
            <button
              aria-expanded={expanded}
              className="flex min-h-11 w-full items-center gap-2 bg-slate-50 px-3 text-left hover:bg-slate-100"
              onClick={() => {
                toggle(setExpandedGroups, expandedGroups, sourceId);
              }}
              type="button"
            >
              {expanded ? (
                <ChevronDown className="size-4 shrink-0" />
              ) : (
                <ChevronRight className="size-4 shrink-0" />
              )}
              <strong className="min-w-0 flex-1 truncate text-sm">{groupLabel}</strong>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {items.length} {items.length === 1 ? "campo" : "campos"}
              </span>
            </button>
            {expanded ? (
              <div className="divide-y divide-slate-100">
                {items.map(({ item, index }) => {
                  const fieldExpanded = expandedFields.has(item.select_id);
                  return (
                    <div className="bg-white" key={item.select_id}>
                      <div className="flex min-h-10 items-center gap-1 px-2">
                        <button
                          aria-expanded={fieldExpanded}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left hover:bg-slate-50"
                          onClick={() => {
                            toggle(setExpandedFields, expandedFields, item.select_id);
                          }}
                          type="button"
                        >
                          {fieldExpanded ? (
                            <ChevronDown className="size-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                            {item.label ?? item.alias ?? item.item_type}
                          </span>
                          {item.alias ? (
                            <span className="max-w-24 truncate text-[10px] text-slate-500">
                              as {item.alias}
                            </span>
                          ) : null}
                          {item.hidden ? (
                            <EyeOff
                              className="size-3.5 shrink-0 text-amber-600"
                              aria-label="Oculto"
                            />
                          ) : null}
                        </button>
                        {["function", "case", "subquery"].includes(item.expression.node_type) ? (
                          <button
                            aria-label={`Editar ${item.label ?? item.item_type}`}
                            className="icon-button size-7"
                            disabled={readOnly}
                            onClick={() => {
                              onEditExpression(item);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        <button
                          aria-label={`Mover arriba ${item.label ?? item.item_type}`}
                          className="icon-button size-7"
                          disabled={readOnly || index === 0}
                          onClick={() => {
                            onChange(queryActions.reorderSelect(document, index, -1));
                          }}
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Mover abajo ${item.label ?? item.item_type}`}
                          className="icon-button size-7"
                          disabled={readOnly || index === document.query.select.length - 1}
                          onClick={() => {
                            onChange(queryActions.reorderSelect(document, index, 1));
                          }}
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Eliminar ${item.label ?? item.item_type}`}
                          className="icon-button size-7 text-red-600"
                          disabled={readOnly || document.query.select.length === 1}
                          onClick={() => {
                            onChange(queryActions.removeSelect(document, item.select_id));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {fieldExpanded ? (
                        <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-3 pt-2">
                          <label className="block text-xs font-semibold">
                            Alias
                            <input
                              className="field mt-1 min-h-9 py-1.5 text-sm"
                              disabled={readOnly}
                              value={item.alias ?? ""}
                              onChange={(event) => {
                                onChange(
                                  queryActions.updateSelect(document, item.select_id, {
                                    alias: event.target.value || null,
                                  }),
                                );
                              }}
                            />
                          </label>
                          <label className="mt-2 flex items-center gap-2 text-xs">
                            <input
                              checked={item.hidden ?? false}
                              disabled={readOnly}
                              onChange={(event) => {
                                onChange(
                                  queryActions.updateSelect(document, item.select_id, {
                                    hidden: event.target.checked,
                                  }),
                                );
                              }}
                              type="checkbox"
                            />
                            Oculto (auxiliar)
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Grouping({
  document,
  entities,
  readOnly,
  onChange,
}: EditorProps & { entities: Record<string, SchemaEntity> }) {
  const [countTarget, setCountTarget] = useState("all");
  const [countDistinct, setCountDistinct] = useState(false);
  const fields = selectedFields(document);
  const availableCountFields = [
    document.query.source,
    ...document.query.joins.map((join) => join.source),
  ].flatMap((source) =>
    (entities[source.entity_id]?.fields ?? [])
      .filter((field) => field.is_active)
      .map((field) => ({
        id: `field:${source.source_id}:${field.id}`,
        label: `${source.alias}.${field.display_name}`,
        expression: fieldExpression(source.source_id, field.id),
      })),
  );
  const availableSubqueries = document.query.select.flatMap((item) =>
    item.expression.node_type === "subquery"
      ? [
          {
            id: `subquery:${item.select_id}`,
            label: item.label ?? item.alias ?? `Subconsulta ${item.select_id.slice(0, 8)}`,
            expression: item.expression,
          },
        ]
      : [],
  );
  const aggregates = document.query.select.filter((item) =>
    containsExpressionType(item.expression, "aggregate"),
  );
  const groupedExpressions = new Set(
    document.query.group_by.map((item) => canonical(item.expression)),
  );
  const groupableExpressions = Array.from(
    document.query.select
      .filter((item) => requiresGroupBy(item.expression))
      .reduce((items, item, index) => {
        const key = canonical(item.expression);
        if (!items.has(key)) {
          const fieldKey = `${String(item.expression.source_id)}:${String(item.expression.field_id)}`;
          items.set(key, {
            key,
            expression: item.expression,
            label:
              fields.find((field) => field.key === fieldKey)?.label ??
              item.label ??
              item.alias ??
              expressionLabel(item.expression, index),
          });
        }
        return items;
      }, new Map<string, { key: string; expression: QueryExpression; label: string }>())
      .values(),
  );
  const pendingExpressions = groupableExpressions.filter(
    (item) => !groupedExpressions.has(item.key),
  );
  return (
    <section>
      <h2 className="font-semibold">Agrupación y agregaciones</h2>
      <p className="mt-1 text-xs text-slate-500">
        Agrupa campos no agregados antes de usar HAVING.
      </p>
      <select
        className="field mt-4"
        disabled={readOnly || !pendingExpressions.length}
        defaultValue=""
        onChange={(event) => {
          const item = groupableExpressions.find((entry) => entry.key === event.target.value);
          if (item) onChange(queryActions.addGroupBy(document, item.expression));
          event.currentTarget.value = "";
        }}
      >
        <option value="">Añadir expresión a GROUP BY…</option>
        {pendingExpressions.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        className="btn-secondary mt-2 w-full"
        disabled={readOnly || !pendingExpressions.length}
        onClick={() => {
          onChange(queryActions.addSelectedFieldsToGroupBy(document));
        }}
      >
        <Plus className="size-4" />
        {pendingExpressions.length
          ? `Agregar todas las expresiones (${String(pendingExpressions.length)})`
          : "Todas las expresiones ya están agrupadas"}
      </button>
      {document.query.group_by.length ? (
        <button
          className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          disabled={readOnly}
          onClick={() => {
            const confirmed = window.confirm(
              `¿Quitar los ${String(document.query.group_by.length)} campos de GROUP BY? Puedes deshacer esta acción.`,
            );
            if (confirmed) onChange(queryActions.clearGroupBy(document));
          }}
        >
          <Trash2 className="size-4" />
          Quitar todos los campos
        </button>
      ) : null}
      <div className="mt-3 space-y-2">
        {document.query.group_by.map((item, index) => {
          const key = canonical(item.expression);
          const label =
            groupableExpressions.find((entry) => entry.key === key)?.label ?? "Expresión agrupada";
          return (
            <div
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
              key={`${key}:${String(index)}`}
            >
              <span className="min-w-0 truncate font-medium" title={label}>
                {label}
              </span>
              <button
                aria-label={`Eliminar ${label} de GROUP BY`}
                className="icon-button"
                disabled={readOnly}
                onClick={() => {
                  onChange(
                    queryActions.update(document, (draft) => {
                      draft.query.group_by.splice(index, 1);
                    }),
                  );
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Agregaciones activas
        </h3>
        {aggregates.length ? (
          <div className="mt-2 space-y-2">
            {aggregates.map((item) => {
              const aggregate =
                typeof item.expression.aggregate === "string"
                  ? item.expression.aggregate.toUpperCase()
                  : "AGREGACIÓN";
              const argument = item.expression.argument as QueryExpression | null | undefined;
              const argumentKey = argument
                ? `${String(argument.source_id)}:${String(argument.field_id)}`
                : null;
              const argumentLabel =
                fields.find((field) => field.key === argumentKey)?.label ??
                (item.expression.aggregate === "count_all" ? "*" : "expresión");
              const distinct = item.expression.distinct === true ? "DISTINCT " : "";
              const label = `${aggregate === "COUNT_ALL" ? "COUNT" : aggregate}(${distinct}${argumentLabel})`;
              return (
                <div
                  className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-sm"
                  key={item.select_id}
                >
                  <span className="min-w-0 truncate font-mono text-xs" title={label}>
                    {label}
                  </span>
                  <button
                    aria-label={`Eliminar agregación ${label}`}
                    className="icon-button text-red-600"
                    disabled={readOnly || document.query.select.length === 1}
                    onClick={() => {
                      onChange(queryActions.removeSelect(document, item.select_id));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No hay agregaciones configuradas.</p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="block text-xs font-semibold text-slate-600">
          Argumento de COUNT
          <select
            className="field mt-1 bg-white"
            disabled={readOnly}
            onChange={(event) => {
              setCountTarget(event.target.value);
              if (event.target.value === "all") setCountDistinct(false);
            }}
            value={countTarget}
          >
            <option value="all">* · Todas las filas</option>
            {availableCountFields.length ? (
              <optgroup label="Campos disponibles">
                {availableCountFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {availableSubqueries.length ? (
              <optgroup label="Subconsultas existentes">
                {availableSubqueries.map((subquery) => (
                  <option key={subquery.id} value={subquery.id}>
                    {subquery.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            checked={countDistinct}
            disabled={readOnly || countTarget === "all"}
            onChange={(event) => {
              setCountDistinct(event.target.checked);
            }}
            type="checkbox"
          />
          Contar valores distintos
        </label>
      </div>
      <button
        className="btn-secondary mt-2 w-full"
        disabled={readOnly}
        onClick={() => {
          const selected = [...availableCountFields, ...availableSubqueries].find(
            (option) => option.id === countTarget,
          );
          const countAll = countTarget === "all";
          if (!countAll && !selected) return;
          const argument: QueryExpression | null = selected
            ? structuredClone(selected.expression)
            : null;
          onChange(
            queryActions.update(document, (draft) => {
              draft.query.select.push({
                select_id: uniqueId("aggregate"),
                item_type: "aggregate",
                expression: {
                  node_type: "aggregate",
                  aggregate: countAll ? "count_all" : "count",
                  argument,
                  distinct: countAll ? false : countDistinct,
                  filter: null,
                },
                alias: "total",
                label: "Total",
                hidden: false,
              });
            }),
          );
        }}
      >
        <Plus className="size-4" />
        Agregar {countDistinct && countTarget !== "all" ? "COUNT DISTINCT" : "COUNT"}
      </button>
    </section>
  );
}

function containsExpressionType(expression: QueryExpression, nodeType: string): boolean {
  if (expression.node_type === nodeType) return true;
  return Object.values(expression).some((value) => {
    if (Array.isArray(value))
      return value.some(
        (child) =>
          Boolean(child) &&
          typeof child === "object" &&
          containsExpressionType(child as QueryExpression, nodeType),
      );
    return (
      Boolean(value) &&
      typeof value === "object" &&
      containsExpressionType(value as QueryExpression, nodeType)
    );
  });
}

function Ordering({ document, readOnly, onChange }: EditorProps) {
  const fields = selectedFields(document);
  return (
    <section>
      <h2 className="font-semibold">Orden y límites</h2>
      <select
        className="field mt-4"
        disabled={readOnly}
        defaultValue=""
        onChange={(event) => {
          const field = fields.find((item) => item.key === event.target.value);
          if (field)
            onChange(
              queryActions.addOrderBy(document, fieldExpression(field.sourceId, field.fieldId)),
            );
          event.currentTarget.value = "";
        }}
      >
        <option value="">Añadir orden…</option>
        {fields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
      <div className="mt-3 space-y-2">
        {document.query.order_by.map((item, index) => (
          <div className="rounded-lg border p-2" key={index}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-xs">Orden {index + 1}</strong>
              <button
                aria-label={`Eliminar orden ${String(index + 1)}`}
                className="icon-button size-7 text-red-600"
                disabled={readOnly}
                onClick={() => {
                  onChange(queryActions.removeOrderBy(document, index));
                }}
                title="Eliminar orden"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <select
              className="field"
              disabled={readOnly}
              value={item.direction}
              onChange={(event) => {
                const value = event.target.value as "ascending" | "descending";
                onChange(
                  queryActions.update(document, (draft) => {
                    const target = draft.query.order_by[index];
                    if (target) target.direction = value;
                  }),
                );
              }}
            >
              <option value="ascending">Ascendente</option>
              <option value="descending">Descendente</option>
            </select>
            <select
              className="field mt-2"
              disabled={readOnly}
              value={item.nulls}
              onChange={(event) => {
                const value = event.target.value as "first" | "last" | "engine_default";
                onChange(
                  queryActions.update(document, (draft) => {
                    const target = draft.query.order_by[index];
                    if (target) target.nulls = value;
                  }),
                );
              }}
            >
              <option value="engine_default">Nulos: motor</option>
              <option value="first">Nulos primero</option>
              <option value="last">Nulos al final</option>
            </select>
          </div>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          checked={document.query.distinct}
          disabled={readOnly}
          type="checkbox"
          onChange={(event) => {
            onChange(queryActions.setBodyValue(document, { distinct: event.target.checked }));
          }}
        />
        Eliminar duplicados (DISTINCT)
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">
          Límite
          <input
            className="field mt-1"
            disabled={readOnly}
            min="0"
            type="number"
            value={document.query.limit ?? ""}
            onChange={(event) => {
              onChange(
                queryActions.setBodyValue(document, {
                  limit: event.target.value ? Number(event.target.value) : null,
                }),
              );
            }}
          />
        </label>
        <label className="text-xs font-semibold">
          Offset
          <input
            className="field mt-1"
            disabled={readOnly}
            min="0"
            type="number"
            value={document.query.offset ?? ""}
            onChange={(event) => {
              onChange(
                queryActions.setBodyValue(document, {
                  offset: event.target.value ? Number(event.target.value) : null,
                }),
              );
            }}
          />
        </label>
      </div>
    </section>
  );
}

function Parameters({ document, readOnly, onChange }: EditorProps) {
  return (
    <section>
      <h2 className="font-semibold">Parámetros</h2>
      <p className="mt-1 text-xs text-slate-500">
        Define contratos; no valores reales de ejecución.
      </p>
      <button
        className="btn-secondary mt-4 w-full"
        disabled={readOnly}
        onClick={() => {
          const id = uniqueId("param");
          const parameter: QueryParameter = {
            parameter_id: id,
            name: id,
            label: "Nuevo parámetro",
            data_type: "string",
            required: true,
            nullable: false,
            validation: {},
            sensitive: false,
            display_order: document.parameters.length,
          };
          onChange(queryActions.addParameter(document, parameter));
        }}
      >
        <Plus className="size-4" />
        Añadir parámetro
      </button>
      <div className="mt-3 space-y-3">
        {document.parameters.map((parameter, index) => (
          <div className="rounded-lg border p-3" key={parameter.parameter_id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="truncate text-xs">{parameter.name}</strong>
              <button
                aria-label={`Eliminar parámetro ${parameter.label}`}
                className="icon-button size-7 text-red-600"
                disabled={readOnly}
                onClick={() => {
                  const confirmed = window.confirm(
                    `¿Eliminar el parámetro ${parameter.label}? Las condiciones que lo referencien quedarán marcadas como inválidas hasta que las corrijas.`,
                  );
                  if (confirmed)
                    onChange(queryActions.removeParameter(document, parameter.parameter_id));
                }}
                title="Eliminar parámetro"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <input
              className="field"
              disabled={readOnly}
              value={parameter.label}
              onChange={(event) => {
                const value = event.target.value;
                onChange(
                  queryActions.update(document, (draft) => {
                    const target = draft.parameters[index];
                    if (target) target.label = value;
                  }),
                );
              }}
            />
            <select
              className="field mt-2"
              disabled={readOnly}
              value={parameter.data_type}
              onChange={(event) => {
                const value = event.target.value;
                onChange(
                  queryActions.update(document, (draft) => {
                    const target = draft.parameters[index];
                    if (target) target.data_type = value;
                  }),
                );
              }}
            >
              {[
                "string",
                "integer",
                "decimal",
                "float",
                "boolean",
                "date",
                "time",
                "datetime",
                "uuid",
                "enum",
                "list",
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <label className="mt-2 flex gap-2 text-xs">
              <input
                checked={parameter.sensitive}
                disabled={readOnly}
                type="checkbox"
                onChange={(event) => {
                  const value = event.target.checked;
                  onChange(
                    queryActions.update(document, (draft) => {
                      const target = draft.parameters[index];
                      if (target) {
                        target.sensitive = value;
                        delete target.default_value;
                      }
                    }),
                  );
                }}
              />
              Sensible
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function Unions({ document, readOnly, onChange }: EditorProps) {
  return (
    <section>
      <h2 className="font-semibold">UNION</h2>
      <p className="mt-1 text-xs text-slate-500">
        Cada rama debe devolver la misma cantidad y tipos compatibles.
      </p>
      <button
        className="btn-secondary mt-4 w-full"
        disabled={readOnly}
        onClick={() => {
          onChange(
            queryActions.update(document, (draft) => {
              const branch = structuredClone(draft.query);
              branch.scope_id = uniqueId("scope");
              branch.unions = [];
              draft.query.unions.push({
                union_id: uniqueId("union"),
                operation: "union",
                query: branch,
              });
            }),
          );
        }}
      >
        <Plus className="size-4" />
        Añadir rama
      </button>
      {document.query.unions.map((union, index) => (
        <div className="mt-3 rounded-lg border p-3" key={union.union_id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-xs">Rama {index + 1}</strong>
            <button
              aria-label={`Eliminar rama UNION ${String(index + 1)}`}
              className="icon-button size-7 text-red-600"
              disabled={readOnly}
              onClick={() => {
                const confirmed = window.confirm(
                  `¿Eliminar la rama UNION ${String(index + 1)}? Se descartará toda su configuración.`,
                );
                if (confirmed) onChange(queryActions.removeUnion(document, union.union_id));
              }}
              title="Eliminar rama UNION"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <select
            className="field"
            disabled={readOnly}
            value={union.operation}
            onChange={(event) => {
              const value = event.target.value as "union" | "union_all";
              onChange(
                queryActions.update(document, (draft) => {
                  const target = draft.query.unions[index];
                  if (target) target.operation = value;
                }),
              );
            }}
          >
            <option value="union">UNION</option>
            <option value="union_all">UNION ALL</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">{union.query.select.length} columna(s)</p>
        </div>
      ))}
    </section>
  );
}
