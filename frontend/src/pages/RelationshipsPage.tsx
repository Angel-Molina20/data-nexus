import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitFork, Network, Plus, ScanSearch, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { BackLink } from "../components/navigation/BackLink";
import { StatusBadge } from "../components/ui/StatusBadge";
import { RelationshipGraph } from "../features/relationships/RelationshipGraph";
import {
  detectRelationshipCandidates,
  getRelationshipGraph,
  listRelationships,
} from "../services/relationships";

export function RelationshipsPage() {
  const { id = "" } = useParams();
  const client = useQueryClient();
  const [view, setView] = useState<"list" | "graph">("list");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const relationships = useQuery({
    queryKey: ["relationships", id],
    queryFn: () => listRelationships(id),
  });
  const graph = useQuery({
    queryKey: ["relationship-graph", id],
    queryFn: () => getRelationshipGraph(id),
    enabled: view === "graph",
  });
  const detect = useMutation({
    mutationFn: () => detectRelationshipCandidates(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["relationships", id] }),
        client.invalidateQueries({ queryKey: ["relationship-candidates", id] }),
        client.invalidateQueries({ queryKey: ["relationship-graph", id] }),
      ]);
    },
  });
  const filtered = useMemo(
    () =>
      relationships.data?.items.filter(
        (item) =>
          (!typeFilter || item.type === typeFilter) &&
          (!statusFilter || item.status === statusFilter) &&
          (!search ||
            `${item.display_name} ${item.source.entity_name} ${item.target?.entity_name ?? ""}`
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase())),
      ) ?? [],
    [relationships.data, search, statusFilter, typeFilter],
  );
  if (relationships.isPending) {
    return <PageContainer><p className="state-message">Cargando relaciones…</p></PageContainer>;
  }
  if (relationships.isError) {
    return <PageContainer><p className="alert-error">No fue posible cargar las relaciones.</p></PageContainer>;
  }
  const summary = relationships.data;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catálogo de relaciones"
        title="Relaciones físicas y lógicas"
        description="Complementa las claves foráneas con relaciones confirmadas por un administrador."
        breadcrumb={<BackLink label="Volver a conexión" to={`/connections/${id}`} variant="breadcrumb" />}
        actions={<>
          <button className="btn-secondary" disabled={detect.isPending} onClick={() => { detect.mutate(); }}>
            <ScanSearch className={`size-4 ${detect.isPending ? "animate-spin" : ""}`} />
            {detect.isPending ? "Detectando…" : "Detectar candidatos"}
          </button>
          <Link className="btn-secondary" to={`/connections/${id}/relationships/polymorphic/new`}><GitFork className="size-4" /> Polimórfica</Link>
          <Link className="btn-primary" to={`/connections/${id}/relationships/new`}><Plus className="size-4" /> Relación manual</Link>
        </>}
      />
      {detect.isSuccess ? <p className="alert-success">Detección completada: {detect.data.created} sugerencia(s) nueva(s).</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Físicas", summary.physical],
          ["Confirmadas", summary.confirmed],
          ["Sugerencias", summary.suggested],
          ["Polimórficas", summary.polymorphic],
          ["Inválidas", summary.invalid],
        ].map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input aria-label="Buscar relaciones" className="field max-w-xs" placeholder="Buscar relaciones…" value={search} onChange={(event) => { setSearch(event.target.value); }} />
        <select aria-label="Filtrar tipo" className="field max-w-48" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); }}><option value="">Todos los tipos</option><option value="physical">Física</option><option value="inferred">Inferida</option><option value="manual">Manual</option><option value="polymorphic">Polimórfica</option></select>
        <select aria-label="Filtrar estado" className="field max-w-48" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); }}><option value="">Todos los estados</option><option value="confirmed">Confirmada</option><option value="suggested">Sugerida</option><option value="disabled">Deshabilitada</option><option value="invalid">Inválida</option></select>
        <div className="ml-auto flex gap-1"><button className={view === "list" ? "btn-primary" : "btn-secondary"} onClick={() => { setView("list"); }}>Lista</button><button className={view === "graph" ? "btn-primary" : "btn-secondary"} onClick={() => { setView("graph"); }}><Network className="size-4" /> Grafo</button></div>
      </div>
      {view === "graph" ? (
        graph.isPending ? <p className="state-message">Preparando grafo…</p> : graph.data ? <RelationshipGraph graph={graph.data} /> : <p className="alert-error">No se pudo cargar el grafo.</p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((item) => (
            <article className="grid gap-3 border-b border-slate-100 p-5 lg:grid-cols-[1fr_auto] lg:items-center" key={`${item.type}-${item.id}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><strong>{item.display_name}</strong><StatusBadge>{item.type}</StatusBadge><StatusBadge variant={item.status === "confirmed" ? "success" : item.status === "invalid" ? "warning" : "info"}>{item.status}</StatusBadge></div>
                <p className="mt-2 text-sm text-slate-600">{item.source.entity_name}.{item.source.fields.join(", ")} → {item.target ? `${item.target.entity_name}.${item.target.fields.join(", ")}` : "destinos según mapping"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.cardinality} · Confianza {Math.round(item.confidence * 100)}% · {item.detection_source}</p>
                {item.invalid_reason ? <p className="mt-2 text-sm text-red-700">{item.invalid_reason}</p> : null}
              </div>
              {item.status === "suggested" ? <Link className="btn-secondary" to={`/connections/${id}/relationships/candidates`}><Sparkles className="size-4" /> Revisar sugerencia</Link> : null}
            </article>
          ))}
          {!filtered.length ? <p className="state-message">No hay relaciones para estos filtros.</p> : null}
        </section>
      )}
      {summary.bridge_candidates.map((item) => <p className="alert-warning" key={item.entity_id}>{item.message} Entidad: {item.entity_name} ({item.reference_fields.join(", ")}).</p>)}
    </PageContainer>
  );
}
