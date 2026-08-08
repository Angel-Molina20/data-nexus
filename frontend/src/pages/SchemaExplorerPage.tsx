import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Database, RefreshCw, Search, Table2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { EmptyState } from "../components/feedback/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { BackLink } from "../components/navigation/BackLink";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EntityDetailPanel } from "../features/schema/EntityDetailPanel";
import {
  getSchemaSummary,
  listSchemaChanges,
  listSchemaEntities,
  listSchemaSynchronizations,
  synchronizeSchema,
} from "../services/schema";

export function SchemaExplorerPage() {
  const { id = "", entityId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const synchronizationInFlight = useRef(false);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const summary = useQuery({ queryKey: ["schema-summary", id], queryFn: () => getSchemaSummary(id) });
  const entities = useQuery({
    queryKey: ["schema-entities", id, search, entityType, showInactive],
    queryFn: () => listSchemaEntities(id, {
      search, entityType, isActive: showInactive ? undefined : true,
    }),
  });
  const history = useQuery({
    queryKey: ["schema-synchronizations", id],
    queryFn: () => listSchemaSynchronizations(id),
  });
  const changes = useQuery({
    queryKey: ["schema-changes", id],
    queryFn: () => listSchemaChanges(id),
  });
  const synchronize = useMutation({
    mutationFn: () => synchronizeSchema(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schema-summary", id] }),
        queryClient.invalidateQueries({ queryKey: ["schema-entities", id] }),
        queryClient.invalidateQueries({ queryKey: ["schema-relationships", id] }),
        queryClient.invalidateQueries({ queryKey: ["schema-synchronizations", id] }),
        queryClient.invalidateQueries({ queryKey: ["schema-changes", id] }),
      ]);
    },
    onSettled: () => {
      synchronizationInFlight.current = false;
    },
  });
  const startSynchronization = () => {
    if (synchronizationInFlight.current) return;
    synchronizationInFlight.current = true;
    synchronize.mutate();
  };
  useEffect(() => {
    if (!entityId && entities.data?.items[0]) {
      void navigate(`/connections/${id}/schema/entities/${entities.data.items[0].id}`, {
        replace: true,
      });
    }
  }, [entities.data, entityId, id, navigate]);

  if (summary.isPending) return <PageContainer><p className="state-message">Cargando esquema…</p></PageContainer>;
  if (summary.isError) return <PageContainer><p className="alert-error">No fue posible cargar el resumen del esquema.</p></PageContainer>;
  const metadata = summary.data;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Explorador de esquemas"
        title={`Esquema: ${metadata.connection_name}`}
        description={`${metadata.engine} ${metadata.raw_version ?? ""} · ${metadata.last_synchronized_at ? `Última sincronización ${new Date(metadata.last_synchronized_at).toLocaleString()}` : "Sin sincronizar"}`}
        breadcrumb={<BackLink label="Volver a conexión" to={`/connections/${id}`} variant="breadcrumb" />}
        actions={<>
          <Link className="btn-secondary" to={`/connections/${id}/schema/synchronizations`}><Clock3 className="size-4" /> Historial</Link>
          <button className="btn-primary" disabled={synchronize.isPending} onClick={startSynchronization}>
            <RefreshCw className={`size-4 ${synchronize.isPending ? "animate-spin" : ""}`} />
            {synchronize.isPending ? "Leyendo metadatos…" : "Sincronizar esquema"}
          </button>
        </>}
      />
      {synchronize.isError ? <p className="alert-error">{synchronize.error.message}</p> : null}
      {synchronize.isSuccess ? <p className="alert-success">Sincronización completada correctamente.</p> : null}
      {metadata.warnings.map((warning) => <p className="alert-warning" key={warning}>{warning}</p>)}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Tablas", metadata.tables], ["Vistas", metadata.views],
          ["Campos", metadata.fields], ["Índices", metadata.indexes],
          ["Relaciones físicas", metadata.physical_relationships],
        ].map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {!metadata.status ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Database} title="Esquema aún no sincronizado" description="Pulsa Sincronizar esquema para leer exclusivamente metadatos estructurales." />
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="field-with-icon"><Search className="size-4" /><input aria-label="Buscar entidades" placeholder="Buscar entidades…" value={search} onChange={(event) => { setSearch(event.target.value); }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select className="field" value={entityType} onChange={(event) => { setEntityType(event.target.value); }}><option value="">Todos</option><option value="table">Tablas</option><option value="view">Vistas</option></select>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showInactive} onChange={(event) => { setShowInactive(event.target.checked); }} /> Inactivos</label>
            </div>
            <div className="mt-4 grid max-h-[620px] gap-1 overflow-y-auto">
              {entities.isPending ? <p className="p-3 text-sm text-slate-500">Cargando entidades…</p> : null}
              {entities.data?.items.map((entity) => (
                <Link className={`rounded-lg p-3 transition ${entity.id === entityId ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`} key={entity.id} to={`/connections/${id}/schema/entities/${entity.id}`}>
                  <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><Table2 className="size-4 shrink-0" /><strong className="truncate text-sm">{entity.physical_name}</strong></span><StatusBadge>{entity.entity_type}</StatusBadge></div>
                  <p className="mt-1 text-xs text-slate-500">{entity.fields_count} campos · {entity.indexes_count} índices · {entity.relationships_count} relaciones</p>
                </Link>
              ))}
              {entities.data?.items.length === 0 ? <p className="p-3 text-sm text-slate-500">Sin resultados.</p> : null}
            </div>
          </aside>
          {entityId ? <EntityDetailPanel connectionId={id} entityId={entityId} /> : <div className="state-message rounded-xl border border-slate-200 bg-white">Selecciona una entidad.</div>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Cambios recientes</h2>
          <div className="mt-3 grid gap-2">{changes.data?.items.slice(0, 6).map((change) => <p className="text-sm text-slate-600" key={change.id}><strong aria-label={change.change_type}>{change.change_type === "added" ? "+" : change.change_type === "removed" ? "−" : "~"}</strong> {change.object_type} {change.physical_name}</p>)}{changes.data?.items.length === 0 ? <p className="text-sm text-slate-500">Sin cambios recientes.</p> : null}</div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Historial reciente</h2>
          <div className="mt-3 grid gap-2">{history.data?.items.slice(0, 4).map((item) => <div className="flex items-center justify-between text-sm" key={item.id}><span>{new Date(item.started_at).toLocaleString()}</span><StatusBadge variant={item.status === "completed" ? "success" : item.status === "failed" ? "warning" : "info"}>{item.status}</StatusBadge></div>)}</div>
        </section>
      </div>
    </PageContainer>
  );
}
