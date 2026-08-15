import { ChevronDown, ChevronUp, MousePointer2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { QueryDocument, QueryExpression, QueryParameter } from "../queries/types";
import type { SchemaEntity } from "../schema/types";
import { queryActions, uniqueId, type BuilderTab } from "./state";

/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-assignment -- recursive expressions are backend-schema validated */

interface EditorProps {
  document: QueryDocument;
  readOnly: boolean;
  onChange: (next: QueryDocument) => void;
}
const labels: Record<BuilderTab, string> = {
  fields: "Campos",
  filters: "Filtros",
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
const selectedFields = (document: QueryDocument) =>
  document.query.select
    .filter((item) => item.expression.node_type === "field")
    .map((item) => ({
      key: `${item.expression.source_id}:${item.expression.field_id}`,
      sourceId: String(item.expression.source_id),
      fieldId: String(item.expression.field_id),
      label: item.label ?? String(item.expression.field_id),
    }));

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
  const tabs: BuilderTab[] = ["fields", "filters", "grouping", "order", "parameters", "unions"];
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
          <div className="flex gap-1 overflow-x-auto border-b p-2">
            {tabs.map((item) => (
              <button
                className={`rounded-md px-2 py-1.5 text-xs font-semibold ${tab === item ? "bg-blue-100 text-blue-700" : "text-slate-500"}`}
                key={item}
                onClick={() => {
                  onTab(item);
                }}
              >
                {labels[item]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "fields" ? (
              <Fields document={document} readOnly={readOnly} onChange={onChange} />
            ) : null}
            {tab === "filters" ? (
              <Filters document={document} readOnly={readOnly} onChange={onChange} />
            ) : null}
            {tab === "grouping" ? (
              <Grouping document={document} readOnly={readOnly} onChange={onChange} />
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

function Fields({ document, readOnly, onChange }: EditorProps) {
  const joinCards = document.query.joins.map((join) => (
    <div className="flex items-center gap-3 rounded-lg border p-3" key={join.join_id}>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm">{join.source.alias}</strong>
        <span className="text-xs text-slate-500">
          {join.join_type.toUpperCase()} ·{" "}
          {join.polymorphic_mapping_id
            ? "Polimórfico"
            : join.relationship_id
              ? "Relación del catálogo"
              : "Manual"}
        </span>
      </div>
      <button
        aria-label={`Quitar join ${join.source.alias}`}
        className="icon-button text-red-600"
        disabled={readOnly}
        title="Quitar join de la consulta"
        onClick={() => {
          const confirmed = window.confirm(
            `¿Quitar el join con ${join.source.alias}? También se quitarán sus campos, filtros, agrupaciones y ordenamientos dependientes.`,
          );
          if (confirmed) onChange(queryActions.removeJoin(document, join.join_id));
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  ));
  return (
    <section>
      <h2 className="font-semibold">Entidades y joins</h2>
      <div className="mt-3 space-y-2">
        {joinCards.length ? (
          joinCards
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-slate-400">
            No hay joins en esta consulta.
          </p>
        )}
      </div>
      <h2 className="mt-6 font-semibold">Campos seleccionados</h2>
      <p className="mt-1 text-xs text-slate-500">El orden define las columnas resultantes.</p>
      <div className="mt-4 space-y-3">
        {document.query.select.map((item, index) => (
          <div className="rounded-lg border p-3" key={item.select_id}>
            <div className="flex items-center gap-2">
              <strong className="mr-auto text-sm">
                {item.label ?? item.alias ?? item.item_type}
              </strong>
              <button
                className="icon-button"
                disabled={readOnly || index === 0}
                aria-label="Mover arriba"
                onClick={() => {
                  onChange(queryActions.reorderSelect(document, index, -1));
                }}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                className="icon-button"
                disabled={readOnly || index === document.query.select.length - 1}
                aria-label="Mover abajo"
                onClick={() => {
                  onChange(queryActions.reorderSelect(document, index, 1));
                }}
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                className="icon-button text-red-600"
                disabled={readOnly || document.query.select.length === 1}
                aria-label="Eliminar"
                onClick={() => {
                  onChange(queryActions.removeSelect(document, item.select_id));
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <label className="mt-2 block text-xs font-semibold">
              Alias
              <input
                className="field mt-1"
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
                disabled={readOnly}
                checked={item.hidden ?? false}
                type="checkbox"
                onChange={(event) => {
                  onChange(
                    queryActions.updateSelect(document, item.select_id, {
                      hidden: event.target.checked,
                    }),
                  );
                }}
              />
              Oculto (auxiliar)
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function Filters({ document, readOnly, onChange }: EditorProps) {
  const [area, setArea] = useState<"where" | "having">("where");
  const fields = selectedFields(document);
  const add = (kind: "comparison" | "is_null" | "between" | "like") => {
    const first = fields[0];
    if (!first) return;
    const field = fieldExpression(first.sourceId, first.fieldId);
    let node: QueryExpression = { node_type: "is_null", expression: field, negated: false };
    if (kind === "comparison")
      node = {
        node_type: "comparison",
        operator: "equals",
        left: field,
        right: { node_type: "literal", value_type: "string", value: "" },
      };
    if (kind === "between")
      node = {
        node_type: "between",
        expression: field,
        lower: { node_type: "literal", value_type: "integer", value: 0 },
        upper: { node_type: "literal", value_type: "integer", value: 1 },
        negated: false,
      };
    if (kind === "like")
      node = {
        node_type: "like",
        expression: field,
        pattern: { node_type: "literal", value_type: "string", value: "%" },
        case_sensitive: false,
        negated: false,
      };
    const current = document.query[area];
    const next = current
      ? ({
          node_type: "logical_group",
          operator: "and",
          conditions:
            current.node_type === "logical_group" && Array.isArray(current.conditions)
              ? [...current.conditions, node]
              : [current, node],
        } as QueryExpression)
      : node;
    onChange(queryActions.setPredicate(document, area, next));
  };
  return (
    <section>
      <div className="flex rounded-lg bg-slate-100 p-1">
        <button
          className={`flex-1 rounded-md py-1 text-xs ${area === "where" ? "bg-white font-semibold shadow" : ""}`}
          onClick={() => {
            setArea("where");
          }}
        >
          WHERE
        </button>
        <button
          className={`flex-1 rounded-md py-1 text-xs ${area === "having" ? "bg-white font-semibold shadow" : ""}`}
          onClick={() => {
            setArea("having");
          }}
        >
          HAVING
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">WHERE filtra filas; HAVING filtra grupos.</p>
      {document.query[area] ? (
        <pre className="mt-4 max-h-52 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100">
          {JSON.stringify(document.query[area], null, 2)}
        </pre>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-slate-400">
          Sin condiciones
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["comparison", "is_null", "between", "like"] as const).map((kind) => (
          <button
            className="btn-secondary px-2 text-xs"
            disabled={readOnly || !fields.length}
            key={kind}
            onClick={() => {
              add(kind);
            }}
          >
            <Plus className="size-3" />
            {kind}
          </button>
        ))}
      </div>
      {document.query[area] ? (
        <button
          className="mt-3 text-xs font-semibold text-red-600"
          disabled={readOnly}
          onClick={() => {
            onChange(queryActions.setPredicate(document, area, null));
          }}
        >
          Limpiar {area.toUpperCase()}
        </button>
      ) : null}
    </section>
  );
}

function Grouping({ document, readOnly, onChange }: EditorProps) {
  const fields = selectedFields(document);
  return (
    <section>
      <h2 className="font-semibold">Agrupación y agregaciones</h2>
      <p className="mt-1 text-xs text-slate-500">
        Agrupa campos no agregados antes de usar HAVING.
      </p>
      <select
        className="field mt-4"
        disabled={readOnly || !fields.length}
        defaultValue=""
        onChange={(event) => {
          const field = fields.find((item) => item.key === event.target.value);
          if (field)
            onChange(
              queryActions.addGroupBy(document, fieldExpression(field.sourceId, field.fieldId)),
            );
          event.currentTarget.value = "";
        }}
      >
        <option value="">Añadir campo a GROUP BY…</option>
        {fields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
      <div className="mt-3 space-y-2">
        {document.query.group_by.map((item, index) => (
          <div
            className="flex items-center justify-between rounded-lg border p-2 text-sm"
            key={index}
          >
            Campo {String(item.expression.field_id).slice(0, 8)}
            <button
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
        ))}
      </div>
      <button
        className="btn-secondary mt-4 w-full"
        disabled={readOnly || !fields.length}
        onClick={() => {
          const field = fields[0];
          if (!field) return;
          onChange(
            queryActions.update(document, (draft) => {
              draft.query.select.push({
                select_id: uniqueId("aggregate"),
                item_type: "aggregate",
                expression: {
                  node_type: "aggregate",
                  aggregate: "count",
                  argument: fieldExpression(field.sourceId, field.fieldId),
                  distinct: false,
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
        Agregar COUNT
      </button>
    </section>
  );
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
