import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Database, Link2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/FeedbackStates";
import type { SemanticEntity } from "../../relationships/types";
import { getSchemaEntity } from "../../schema/api/schemaApi";
import type { SchemaEntitySummary } from "../../schema/types";
import type { QuerySource } from "../../queries/types";
import { EntityFieldItem } from "./EntityFieldItem";

export function EntityCatalogItem({
  canUseSensitive,
  connectionId,
  entity,
  expanded,
  inspectedFieldId,
  onAddRelationship,
  onInspectEntity,
  onInspectField,
  onToggle,
  onToggleFields,
  readOnly,
  search,
  selectedFieldIds,
  semantic,
  source,
}: {
  canUseSensitive: boolean;
  connectionId: string;
  entity: SchemaEntitySummary;
  expanded: boolean;
  inspectedFieldId: string | null;
  onAddRelationship: () => void;
  onInspectEntity: () => void;
  onInspectField: (fieldId: string) => void;
  onToggle: () => void;
  onToggleFields: (fields: Array<{ id: string; label: string }>, selected: boolean) => void;
  readOnly: boolean;
  search: string;
  selectedFieldIds: Set<string>;
  semantic?: SemanticEntity;
  source?: QuerySource;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const detail = useQuery({
    queryKey: ["builder-entity", connectionId, entity.id],
    queryFn: () => getSchemaEntity(connectionId, entity.id),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  });
  const semanticFields = useMemo(
    () => new Map(semantic?.fields.map((field) => [field.id, field]) ?? []),
    [semantic],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const entityMatches = [entity.display_name, entity.physical_name, entity.schema_name]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalizedSearch);
  const visibleFields = useMemo(() => {
    const fields = detail.data?.fields.filter((field) => field.is_active) ?? [];
    if (!normalizedSearch || entityMatches) return fields;
    return fields.filter((field) => {
      const semanticField = semanticFields.get(field.id);
      return [
        field.display_name,
        field.physical_name,
        semanticField?.display_name,
        semanticField?.semantic_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    });
  }, [detail.data, entityMatches, normalizedSearch, semanticFields]);
  const selectableFields = visibleFields.filter((field) => {
    const semanticField = semanticFields.get(field.id);
    return (semanticField?.is_visible ?? true) && (!semanticField?.is_sensitive || canUseSensitive);
  });
  const selectedCount = detail.data
    ? detail.data.fields.filter((field) => selectedFieldIds.has(field.id)).length
    : selectedFieldIds.size;
  const selectedSelectable = selectableFields.filter((field) => selectedFieldIds.has(field.id));
  const allSelected =
    selectableFields.length > 0 && selectedSelectable.length === selectableFields.length;
  const indeterminate = selectedSelectable.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const foreignKeys = useMemo(() => {
    const result = new Map<string, string>();
    for (const relationship of detail.data?.outgoing_relationships ?? []) {
      for (const field of relationship.fields)
        result.set(field.source_field, `${relationship.target_entity}.${field.target_field}`);
    }
    return result;
  }, [detail.data]);

  return (
    <li className="border-b border-slate-100" data-entity-id={entity.id}>
      <div className={`flex min-h-10 items-center gap-1 px-2 ${source ? "bg-blue-50/70" : ""}`}>
        <button
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left focus-visible:outline-2"
          onClick={onToggle}
          type="button"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <Database className="size-3.5 shrink-0 text-slate-400" />
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold"
            title={`${entity.schema_name}.${entity.physical_name}`}
          >
            {entity.display_name}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
            {selectedCount} / {entity.fields_count}
          </span>
        </button>
        {source ? (
          <button onClick={onInspectEntity} type="button" title="Ver entidad en el lienzo">
            <Badge className="px-1.5 py-0.5" variant="success">
              En uso
            </Badge>
          </button>
        ) : (
          <Button
            aria-label={`Añadir relación con ${entity.display_name}`}
            disabled={readOnly}
            onClick={onAddRelationship}
            size="sm"
            title="Añadir mediante una relación confirmada"
            variant="ghost"
          >
            <Link2 className="size-3.5" />
          </Button>
        )}
      </div>
      {expanded ? (
        <div className="pb-1 pl-6 pr-2">
          {detail.isPending ? (
            <div
              className="space-y-1 py-2"
              role="status"
              aria-label={`Cargando campos de ${entity.display_name}`}
            >
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
            </div>
          ) : detail.isError ? (
            <div className="flex items-center justify-between gap-2 py-2 text-xs text-red-600">
              No fue posible cargar los campos.
              <button className="font-semibold" onClick={() => void detail.refetch()} type="button">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <label className="flex min-h-8 items-center gap-2 border-b border-slate-100 px-2 text-xs font-semibold text-slate-600">
                <input
                  aria-label={`Seleccionar todos los campos de ${entity.display_name}`}
                  checked={allSelected}
                  className="size-4 accent-primary"
                  disabled={!source || readOnly || selectableFields.length === 0}
                  onChange={(event) => {
                    onToggleFields(
                      selectableFields.map((field) => ({
                        id: field.id,
                        label: semanticFields.get(field.id)?.display_name || field.display_name,
                      })),
                      event.target.checked,
                    );
                  }}
                  ref={selectAllRef}
                  type="checkbox"
                />
                Seleccionar todos
              </label>
              <ul aria-label={`Campos de ${entity.display_name}`}>
                {visibleFields.map((field) => {
                  const semanticField = semanticFields.get(field.id);
                  const sensitiveBlocked = Boolean(semanticField?.is_sensitive && !canUseSensitive);
                  return (
                    <EntityFieldItem
                      checked={selectedFieldIds.has(field.id)}
                      disabled={!source || readOnly || sensitiveBlocked}
                      field={field}
                      foreignKey={foreignKeys.get(field.physical_name)}
                      inspected={inspectedFieldId === field.id}
                      key={field.id}
                      onInspect={() => {
                        onInspectField(field.id);
                      }}
                      onToggle={(checked) => {
                        onToggleFields(
                          [
                            {
                              id: field.id,
                              label: semanticField?.display_name || field.display_name,
                            },
                          ],
                          checked,
                        );
                      }}
                      semantic={semanticField}
                    />
                  );
                })}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
