import { useQueries } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../../components/ui/Button";
import type { QueryBody, QueryExpression, QueryParameter } from "../../../queries/types";
import { getSchemaEntity } from "../../../schema/api/schemaApi";
import { buildPredicate, normalizedFilterType } from "../model/predicates";
import { emptyFilterDraft, type FilterDraft, type FilterFieldOption } from "../model/types";
import { FilterConditionDraft } from "./FilterConditionDraft";

export function SubqueryWhereEditor({
  connectionId,
  query,
  parameters,
  predicates,
  onChange,
}: {
  connectionId: string;
  query: QueryBody;
  parameters: QueryParameter[];
  predicates: QueryExpression[];
  onChange: (predicates: QueryExpression[], draftActive: boolean) => void;
}) {
  const [draft, setDraft] = useState<FilterDraft | null>(null);
  const sources = [query.source, ...query.joins.map((join) => join.source)];
  const entityQueries = useQueries({
    queries: sources.map((source) => ({
      queryKey: ["subquery-where-entity", connectionId, source.entity_id],
      queryFn: () => getSchemaEntity(connectionId, source.entity_id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const fields = sources.flatMap((source, index) => {
    const entity = entityQueries[index]?.data;
    return (entity?.fields ?? []).map(
      (field) =>
        ({
          id: `inner:${source.source_id}:${field.id}`,
          sourceId: source.source_id,
          fieldId: field.id,
          label: `${source.alias}.${field.display_name}`,
          searchText:
            `${source.alias} ${entity?.display_name ?? ""} ${field.display_name} ${field.physical_name}`.toLocaleLowerCase(),
          dataType: normalizedFilterType(field.normalized_data_type),
          expression: { node_type: "field", source_id: source.source_id, field_id: field.id },
          aggregate: false,
          available: field.is_active,
        }) satisfies FilterFieldOption,
    );
  });
  const closeDraft = () => {
    setDraft(null);
    onChange(predicates, false);
  };
  return (
    <section className="rounded-md border border-slate-200 bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h3 className="text-sm font-semibold">WHERE adicional de la subconsulta</h3>
          <p className="text-xs text-slate-500">
            Se combina mediante AND con el WHERE guardado y la correlación.
          </p>
        </div>
        {!draft && fields.length ? (
          <Button
            onClick={() => {
              setDraft(emptyFilterDraft());
              onChange(predicates, true);
            }}
            size="sm"
            variant="secondary"
          >
            Añadir condición interna
          </Button>
        ) : null}
      </div>
      {query.where ? (
        <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
          El WHERE existente de la consulta guardada se conservará.
        </p>
      ) : null}
      {predicates.map((predicate, index) => (
        <div
          className="mt-2 flex items-center justify-between rounded border px-2 py-1.5 text-xs"
          key={index}
        >
          <span>
            Condición interna {index + 1}: {predicate.node_type}
          </span>
          <button
            aria-label={`Eliminar condición interna ${String(index + 1)}`}
            className="icon-button"
            onClick={() => {
              onChange(
                predicates.filter((_, currentIndex) => currentIndex !== index),
                false,
              );
            }}
            type="button"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      {draft ? (
        <div className="mt-3">
          <FilterConditionDraft
            draft={draft}
            fields={fields}
            onCancel={closeDraft}
            onChange={setDraft}
            onCommit={() => {
              const predicate = buildPredicate(draft, fields);
              if (predicate) {
                setDraft(null);
                onChange([...predicates, predicate], false);
              }
            }}
            parameters={parameters}
          />
        </div>
      ) : null}
      {!fields.length ? (
        <p className="mt-2 text-xs text-amber-700">Cargando metadata de los campos internos…</p>
      ) : null}
    </section>
  );
}
