import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsUp, Database } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyStateBase, Skeleton } from "../../components/ui/FeedbackStates";
import { IconButton } from "../../components/ui/IconButton";
import { SearchInput } from "../../components/ui/SearchInput";
import { listSemanticEntities } from "../relationships/api/relationshipsApi";
import type { QueryDocument } from "../queries/types";
import { EntityCatalogItem } from "./catalog/EntityCatalogItem";
import { useQueryCatalog } from "./catalog/useQueryCatalog";

export function QueryCatalogPanel({
  canUseSensitive,
  document,
  onAddRelationship,
  onEntity,
  onFields,
  readOnly,
}: {
  canUseSensitive: boolean;
  document: QueryDocument;
  onAddRelationship: () => void;
  onEntity: (sourceId: string) => void;
  onFields: (
    sourceId: string,
    fields: Array<{ id: string; label: string }>,
    selected: boolean,
  ) => void;
  readOnly: boolean;
}) {
  const catalog = useQueryCatalog(document.connection_id);
  const [inspectedFieldId, setInspectedFieldId] = useState<string | null>(null);
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set(["table"]));
  const semantics = useQuery({
    queryKey: ["builder-semantics", document.connection_id],
    queryFn: () => listSemanticEntities(document.connection_id),
    staleTime: 5 * 60 * 1000,
  });
  const semanticEntities = useMemo(
    () => new Map(semantics.data?.items.map((entity) => [entity.id, entity]) ?? []),
    [semantics.data],
  );
  const sources = useMemo(
    () => [document.query.source, ...document.query.joins.map((join) => join.source)],
    [document.query.joins, document.query.source],
  );
  const selectedBySource = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const source of sources) result.set(source.source_id, new Set());
    for (const item of document.query.select) {
      if (item.expression.node_type !== "field") continue;
      const sourceId =
        typeof item.expression.source_id === "string" ? item.expression.source_id : "";
      const fieldId = typeof item.expression.field_id === "string" ? item.expression.field_id : "";
      result.get(sourceId)?.add(fieldId);
    }
    return result;
  }, [document.query.select, sources]);

  return (
    <aside
      className="flex h-full min-h-0 flex-col border-r bg-white"
      aria-label="Catálogo de consulta"
    >
      <header className="sticky top-0 z-10 border-b bg-white px-3 pb-3 pt-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Entidades</h2>
            <p className="text-[11px] text-slate-500">
              {catalog.query.data?.pages[0]?.total ?? 0} disponibles
            </p>
          </div>
          <IconButton
            label="Colapsar todas las entidades"
            onClick={() => {
              catalog.collapseAll();
            }}
            size="sm"
          >
            <ChevronsUp className="size-4" />
          </IconButton>
        </div>
        <SearchInput
          aria-label="Buscar tablas o campos"
          loading={catalog.searching}
          onChange={(event) => {
            catalog.setSearch(event.target.value);
          }}
          onClear={() => {
            catalog.setSearch("");
          }}
          placeholder="Buscar tablas o campos…"
          value={catalog.search}
        />
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-testid="catalog-scroll"
      >
        {catalog.query.isPending ? (
          <div className="space-y-2 p-3" role="status" aria-label="Cargando entidades">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-10" key={index} />
            ))}
          </div>
        ) : catalog.query.isError ? (
          <div className="p-4 text-center text-sm text-red-600">
            <p>No fue posible cargar el catálogo.</p>
            <button
              className="mt-2 font-semibold"
              onClick={() => void catalog.query.refetch()}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : catalog.entities.length === 0 ? (
          <EmptyStateBase
            description={
              catalog.search
                ? `No encontramos tablas o campos para “${catalog.search}”.`
                : "No se encontraron entidades disponibles."
            }
            icon={Database}
            title={catalog.search ? "Sin coincidencias" : "Catálogo vacío"}
          />
        ) : (
          <div aria-label="Entidades disponibles">
            {(
              [
                ["table", "Tablas"],
                ["view", "Vistas"],
              ] as const
            ).map(([kind, label]) => {
              const entities = catalog.entities.filter((entity) => entity.entity_type === kind);
              const open = Boolean(catalog.search) || openKinds.has(kind);
              return (
                <section className="border-b border-slate-200" key={kind}>
                  <button
                    aria-expanded={open}
                    className="sticky top-0 z-[1] flex min-h-10 w-full items-center gap-2 bg-slate-50 px-3 text-left hover:bg-slate-100"
                    onClick={() => {
                      const next = new Set(openKinds);
                      if (next.has(kind)) next.delete(kind);
                      else next.add(kind);
                      setOpenKinds(next);
                    }}
                    type="button"
                  >
                    {open ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                    <strong className="flex-1 text-xs uppercase tracking-wide text-slate-600">
                      {label}
                    </strong>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {entities.length}
                    </span>
                  </button>
                  {open ? (
                    entities.length ? (
                      <ul aria-label={label}>
                        {entities.map((entity) => {
                          const source = sources.find((item) => item.entity_id === entity.id);
                          return (
                            <EntityCatalogItem
                              canUseSensitive={canUseSensitive}
                              connectionId={document.connection_id}
                              entity={entity}
                              expanded={catalog.isExpanded(entity.id)}
                              inspectedFieldId={inspectedFieldId}
                              key={entity.id}
                              onAddRelationship={onAddRelationship}
                              onInspectEntity={() => {
                                if (source) onEntity(source.source_id);
                              }}
                              onInspectField={(fieldId) => {
                                setInspectedFieldId(fieldId);
                                if (source) onEntity(source.source_id);
                              }}
                              onToggle={() => {
                                catalog.toggle(entity.id);
                              }}
                              onToggleFields={(fields, selected) => {
                                if (source) onFields(source.source_id, fields, selected);
                              }}
                              readOnly={readOnly}
                              search={catalog.search}
                              selectedFieldIds={
                                source
                                  ? (selectedBySource.get(source.source_id) ?? new Set())
                                  : new Set()
                              }
                              semantic={semanticEntities.get(entity.id)}
                              source={source}
                            />
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-xs text-slate-400">
                        No hay {label.toLowerCase()}.
                      </p>
                    )
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
