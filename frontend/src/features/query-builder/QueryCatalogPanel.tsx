import { useQuery } from "@tanstack/react-query";
import { Eye, Plus, Search, ShieldAlert } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { getSchemaEntity, listSchemaEntities } from "../schema/api/schemaApi";
import { listSemanticEntities } from "../relationships/api/relationshipsApi";
import type { QueryDocument } from "../queries/types";

export function QueryCatalogPanel({
  document,
  selectedSourceId,
  canUseSensitive,
  onEntity,
  onField,
  onInspect,
}: {
  document: QueryDocument;
  selectedSourceId: string;
  canUseSensitive: boolean;
  onEntity: (id: string) => void;
  onField: (fieldId: string, label: string) => void;
  onInspect: (entityId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const entities = useQuery({
    queryKey: ["builder-entities", document.connection_id, deferred],
    queryFn: () => listSchemaEntities(document.connection_id, { search: deferred, isActive: true }),
  });
  const semantics = useQuery({
    queryKey: ["builder-semantics", document.connection_id],
    queryFn: () => listSemanticEntities(document.connection_id),
  });
  const semanticFields = new Map(
    semantics.data?.items.flatMap((entity) =>
      entity.fields.map((field) => [field.id, field] as const),
    ) ?? [],
  );
  const source =
    [document.query.source, ...document.query.joins.map((join) => join.source)].find(
      (item) => item.source_id === selectedSourceId,
    ) ?? document.query.source;
  const detail = useQuery({
    queryKey: ["builder-entity", document.connection_id, source.entity_id],
    queryFn: () => getSchemaEntity(document.connection_id, source.entity_id),
  });
  return (
    <aside
      className="flex h-full min-h-0 flex-col border-r bg-white"
      aria-label="Catálogo de consulta"
    >
      <div className="border-b p-4">
        <h2 className="font-semibold">Catálogo</h2>
        <label className="field-with-icon mt-3">
          <Search className="size-4" />
          <span className="sr-only">Buscar entidades</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Buscar entidades…"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Entidades</h3>
        {entities.isPending ? (
          <p className="p-3 text-sm text-slate-500">Cargando…</p>
        ) : (
          entities.data?.items.map((entity) => {
            const used = [
              document.query.source,
              ...document.query.joins.map((join) => join.source),
            ].some((item) => item.entity_id === entity.id);
            return (
              <div
                className={`mb-2 rounded-lg border p-3 ${used ? "border-blue-200 bg-blue-50" : "border-slate-200"}`}
                key={entity.id}
              >
                <button
                  className="w-full text-left"
                  onClick={() => {
                    if (used) {
                      const found = [
                        document.query.source,
                        ...document.query.joins.map((join) => join.source),
                      ].find((item) => item.entity_id === entity.id);
                      if (found) onEntity(found.source_id);
                    } else onInspect(entity.id);
                  }}
                >
                  <strong className="block text-sm">{entity.display_name}</strong>
                  <span className="text-xs text-slate-500">
                    {entity.physical_name} · {entity.entity_type} · {entity.fields_count} campos
                  </span>
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    className="text-xs font-semibold text-blue-700"
                    onClick={() => {
                      onInspect(entity.id);
                    }}
                  >
                    <Eye className="mr-1 inline size-3" />
                    Detalle
                  </button>
                  {used ? (
                    <span className="text-xs font-semibold text-emerald-700">En uso</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Campos de {detail.data?.display_name ?? "la entidad"}
        </h3>
        {detail.data?.fields
          .filter((field) => field.is_active)
          .map((field) => {
            const semantic = semanticFields.get(field.id);
            const sensitive = semantic?.is_sensitive ?? false;
            const visible = semantic?.is_visible ?? true;
            const selected = document.query.select.some(
              (item) =>
                item.expression.field_id === field.id &&
                item.expression.source_id === source.source_id,
            );
            return (
              <div
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
                key={field.id}
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {semantic?.display_name ?? field.display_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {field.native_data_type}
                    {field.is_primary_key ? " · PK" : ""}
                    {sensitive ? " · Sensible" : ""}
                    {!visible ? " · Oculto" : ""}
                  </span>
                </div>
                <button
                  className="icon-button"
                  disabled={selected || !visible || (sensitive && !canUseSensitive)}
                  title={
                    selected
                      ? "Ya seleccionado"
                      : !visible
                        ? "Campo oculto"
                        : sensitive && !canUseSensitive
                          ? "Requiere permiso para campos sensibles"
                          : "Añadir campo"
                  }
                  onClick={() => {
                    onField(field.id, semantic?.display_name ?? field.display_name);
                  }}
                >
                  {sensitive ? <ShieldAlert className="size-4" /> : <Plus className="size-4" />}
                </button>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
