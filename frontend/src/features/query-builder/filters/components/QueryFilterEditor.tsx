import { useQuery } from "@tanstack/react-query";
import { Filter, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Tabs } from "../../../../components/ui/Tabs";
import { listSemanticEntities } from "../../../relationships/api/relationshipsApi";
import type { SchemaEntity } from "../../../schema/types";
import type { QueryDocument, QueryExpression } from "../../../queries/types";
import { queryActions } from "../../state";
import { FilterConditionDraft } from "./FilterConditionDraft";
import { FilterGroup } from "./FilterGroup";
import { FilterSubqueryEditor } from "./FilterSubqueryEditor";
import {
  appendPredicate,
  duplicatePredicate,
  normalizedFilterType,
  predicateCount,
  reorderPredicate,
  updatePredicateAt,
  type PredicatePath,
} from "../model/predicates";
import {
  emptyFilterDraft,
  type FilterArea,
  type FilterDraft,
  type FilterFieldOption,
} from "../model/types";
import { buildPredicate } from "../model/predicates";

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- conditions is narrowed at runtime from the recursive backend-validated QueryExpression contract. */

export function QueryFilterEditor({
  document,
  entities,
  readOnly,
  canUseSensitive,
  initialArea,
  focusIssueId,
  onChange,
}: {
  document: QueryDocument;
  entities: Record<string, SchemaEntity>;
  readOnly: boolean;
  canUseSensitive: boolean;
  initialArea?: FilterArea;
  focusIssueId?: string | null;
  onChange: (document: QueryDocument) => void;
}) {
  const [area, setArea] = useState<FilterArea>(initialArea ?? "where");
  const [draft, setDraft] = useState<FilterDraft | null>(null);
  const [target, setTarget] = useState<{ path: PredicatePath; group: boolean } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<{
    path: PredicatePath;
    node: QueryExpression;
  } | null>(null);
  const [subqueryTarget, setSubqueryTarget] = useState<PredicatePath | null>(null);
  const semantics = useQuery({
    queryKey: ["builder-semantics", document.connection_id],
    queryFn: () => listSemanticEntities(document.connection_id),
    staleTime: 5 * 60 * 1000,
  });
  const fields = useMemo(
    () => filterFields(document, entities, semantics.data?.items ?? [], canUseSensitive, area),
    [area, canUseSensitive, document, entities, semantics.data],
  );
  const root = document.query[area] ?? null;
  const focusPath = useMemo(() => {
    if (!focusIssueId?.startsWith(`${area}:`)) return null;
    const raw = focusIssueId.slice(area.length + 1);
    return raw
      ? raw
          .split(".")
          .map((item) => Number.parseInt(item, 10))
          .filter(Number.isFinite)
      : [];
  }, [area, focusIssueId]);
  const commitRoot = (next: QueryExpression | null) => {
    onChange(queryActions.setPredicate(document, area, next));
  };
  const addDraft = (path: PredicatePath, group: boolean) => {
    setTarget({ path, group });
    setDraft(emptyFilterDraft());
  };
  const applyDraft = () => {
    if (!draft || !target) return;
    const predicate = buildPredicate(draft, fields);
    if (!predicate) return;
    insertPredicate(predicate, target.path, target.group);
    setDraft(null);
    setTarget(null);
  };
  const insertPredicate = (predicate: QueryExpression, path: PredicatePath, group = false) => {
    if (!root)
      commitRoot(
        group
          ? { node_type: "logical_group", operator: "and", conditions: [predicate] }
          : predicate,
      );
    else if (!path.length) commitRoot(addToNode(root, predicate, group));
    else commitRoot(updatePredicateAt(root, path, (node) => addToNode(node, predicate, group)));
  };
  const content = (
    <div className="space-y-3" data-filter-area={area}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Info className="size-3.5" />
        <span>
          {area === "where"
            ? "Filtra filas antes de agrupar."
            : "Filtra resultados después de aplicar agregaciones."}
        </span>
        {area === "having" &&
        !document.query.select.some((item) => item.expression.node_type === "aggregate") ? (
          <span className="font-semibold text-amber-700">
            Añade una agregación para construir un HAVING útil.
          </span>
        ) : null}
      </div>
      {root ? (
        <FilterGroup
          connectionId={document.connection_id}
          fields={fields}
          focusPath={focusPath}
          node={root}
          onAdd={addDraft}
          onAddSubquery={setSubqueryTarget}
          onChangeOperator={(path, operator) => {
            if (!path.length && root.node_type !== "logical_group") return;
            commitRoot(
              updatePredicateAt(root, path, (node) =>
                node.node_type === "logical_group" ? { ...node, operator } : node,
              ),
            );
          }}
          onDelete={(path) => {
            commitRoot(updatePredicateAt(root, path, () => null));
          }}
          onDuplicate={(path) => {
            commitRoot(duplicatePredicate(root, path));
          }}
          onMove={(path, direction) => {
            commitRoot(reorderPredicate(root, path, direction));
          }}
          onReplace={(path, node) => {
            commitRoot(updatePredicateAt(root, path, () => node));
          }}
          onRequestDeleteGroup={(path, node) => {
            setDeleteGroup({ path, node });
          }}
          parameters={document.parameters}
          path={[]}
          readOnly={readOnly}
          root
          scopeId={document.query.scope_id}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Filter className="mx-auto size-6 text-slate-400" />
          <p className="mt-2 text-sm font-semibold">
            No hay {area === "where" ? "filtros WHERE" : "condiciones HAVING"} configurados.
          </p>
          {!readOnly ? (
            <div className="mt-3 flex justify-center gap-2">
              <Button
                onClick={() => {
                  addDraft([], false);
                }}
                size="sm"
              >
                Añadir condición
              </Button>
              <Button
                onClick={() => {
                  setSubqueryTarget([]);
                }}
                size="sm"
                variant="secondary"
              >
                Añadir subconsulta
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {draft ? (
        <FilterConditionDraft
          draft={draft}
          fields={fields}
          onCancel={() => {
            setDraft(null);
            setTarget(null);
          }}
          onChange={setDraft}
          onCommit={applyDraft}
          parameters={document.parameters}
        />
      ) : null}
      {subqueryTarget ? (
        <FilterSubqueryEditor
          connectionId={document.connection_id}
          fields={fields}
          onCancel={() => {
            setSubqueryTarget(null);
          }}
          onCommit={(predicate) => {
            insertPredicate(predicate, subqueryTarget);
            setSubqueryTarget(null);
          }}
          scopeId={document.query.scope_id}
        />
      ) : null}
      {root && !readOnly && !draft && !subqueryTarget ? (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              addDraft([], false);
            }}
            size="sm"
            variant="secondary"
          >
            + Condición raíz
          </Button>
          <Button
            onClick={() => {
              addDraft([], true);
            }}
            size="sm"
            variant="ghost"
          >
            + Grupo raíz
          </Button>
          <Button
            onClick={() => {
              setSubqueryTarget([]);
            }}
            size="sm"
            variant="ghost"
          >
            + Subconsulta raíz
          </Button>
        </div>
      ) : null}
      {focusIssueId?.startsWith(`${area}:`) ? (
        <p
          className="animate-pulse rounded-md bg-amber-50 p-2 text-xs text-amber-800"
          role="status"
        >
          Se abrió el filtro relacionado con el problema seleccionado.
        </p>
      ) : null}
    </div>
  );
  return (
    <section aria-label="Editor visual de filtros" className="mx-auto max-w-[110rem]">
      <Tabs
        activeId={area}
        label="Tipo de filtro"
        onChange={(id) => {
          setArea(id as FilterArea);
          setDraft(null);
          setTarget(null);
          setSubqueryTarget(null);
        }}
        tabs={[
          { id: "where", label: "WHERE", content },
          { id: "having", label: "HAVING", content },
        ]}
      />
      <ConfirmDialog
        description="Eliminar grupo de filtros"
        onCancel={() => {
          setDeleteGroup(null);
        }}
        onConfirm={() => {
          if (deleteGroup && root)
            commitRoot(updatePredicateAt(root, deleteGroup.path, () => null));
          setDeleteGroup(null);
        }}
        open={Boolean(deleteGroup)}
        supportingText={`Se eliminarán ${String(deleteGroup ? predicateCount(deleteGroup.node) : 0)} condiciones. Puedes recuperarlas inmediatamente con Deshacer.`}
        title="¿Eliminar este grupo?"
      />
    </section>
  );
}

function addToNode(
  node: QueryExpression,
  predicate: QueryExpression,
  group: boolean,
): QueryExpression {
  const added = group
    ? ({ node_type: "logical_group", operator: "and", conditions: [predicate] } as QueryExpression)
    : predicate;
  if (node.node_type === "logical_group" && Array.isArray(node.conditions))
    return { ...structuredClone(node), conditions: [...node.conditions, added] };
  return appendPredicate(node, added);
}

function filterFields(
  document: QueryDocument,
  entities: Record<string, SchemaEntity>,
  semanticEntities: Array<{
    id: string;
    fields: Array<{ id: string; display_name: string; is_visible: boolean; is_sensitive: boolean }>;
  }>,
  canUseSensitive: boolean,
  area: FilterArea,
): FilterFieldOption[] {
  const semantics = new Map(
    semanticEntities.map((entity) => [
      entity.id,
      new Map(entity.fields.map((field) => [field.id, field])),
    ]),
  );
  const sources = [document.query.source, ...document.query.joins.map((join) => join.source)];
  const fields: FilterFieldOption[] = sources.flatMap((source) => {
    const entity = entities[source.entity_id];
    if (!entity) return [];
    const semantic = semantics.get(entity.id);
    return entity.fields.map((field) => {
      const policy = semantic?.get(field.id);
      const label = `${source.alias}.${policy?.display_name || field.display_name}`;
      return {
        id: `field:${source.source_id}:${field.id}`,
        sourceId: source.source_id,
        fieldId: field.id,
        label,
        searchText:
          `${source.alias} ${entity.display_name} ${entity.physical_name} ${field.display_name} ${field.physical_name} ${policy?.display_name ?? ""}`.toLocaleLowerCase(),
        dataType: normalizedFilterType(field.normalized_data_type),
        expression: { node_type: "field", source_id: source.source_id, field_id: field.id },
        aggregate: false,
        available:
          field.is_active &&
          (policy?.is_visible ?? true) &&
          (!policy?.is_sensitive || canUseSensitive),
      } satisfies FilterFieldOption;
    });
  });
  if (area === "having")
    for (const item of document.query.select)
      if (item.expression.node_type === "aggregate") {
        const label =
          item.label || item.alias || `${String(item.expression.aggregate).toUpperCase()}(…)`;
        fields.push({
          id: `aggregate:${item.select_id}`,
          sourceId: "aggregate",
          label,
          searchText: `${label} ${item.alias ?? ""}`.toLocaleLowerCase(),
          dataType:
            item.expression.aggregate === "count" || item.expression.aggregate === "count_all"
              ? "integer"
              : item.expression.aggregate === "group_concat"
                ? "string"
                : "decimal",
          expression: structuredClone(item.expression),
          aggregate: true,
          available: true,
        });
      }
  return fields;
}
