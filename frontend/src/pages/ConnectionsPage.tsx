import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "../components/feedback/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  deleteConnection,
  listConnections,
  retestConnection,
} from "../services/connections";

const statusLabels = {
  connected: "Conectada",
  disconnected: "Desconectada",
  error: "Error",
  testing: "Probando",
};

export function ConnectionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["connections", search, status],
    queryFn: () => listConnections({ search, status }),
  });
  const remove = useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });
  const retest = useMutation({
    mutationFn: retestConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });

  function confirmDelete(id: string, name: string) {
    if (window.confirm(`¿Eliminar la conexión “${name}”? Solo se borrará su configuración local.`)) {
      remove.mutate(id);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Conexiones"
        description="Administra de forma segura las fuentes MySQL disponibles."
        actions={
          <Link className="btn-primary" to="/connections/new">
            <Plus aria-hidden="true" className="size-4" /> Nueva conexión
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="field-with-icon">
          <span className="sr-only">Buscar conexiones</span>
          <Search aria-hidden="true" className="size-4" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); }}
            placeholder="Buscar por nombre"
          />
        </label>
        <select className="field" value={status} onChange={(event) => { setStatus(event.target.value); }}>
          <option value="">Todos los estados</option>
          <option value="connected">Conectadas</option>
          <option value="error">Con error</option>
          <option value="disconnected">Desconectadas</option>
        </select>
      </div>
      <PageSection>
        {query.isPending ? <p className="state-message">Cargando conexiones…</p> : null}
        {query.isError ? <p className="state-message text-red-700">No fue posible cargar las conexiones.</p> : null}
        {query.data?.items.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Aún no hay conexiones registradas"
            description="Registra MySQL 5.6 o MySQL 8 para comenzar."
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Conexión</th><th>Servidor</th><th>Versión</th><th>Estado</th><th>Última prueba</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong><small>{item.database_name}</small></td>
                    <td>{item.host}:{item.port}<small>{item.provider}</small></td>
                    <td>{item.raw_version ?? "Sin detectar"}</td>
                    <td><StatusBadge variant={item.status === "connected" ? "success" : item.status === "error" ? "warning" : "neutral"}>{statusLabels[item.status]}</StatusBadge></td>
                    <td>{item.last_tested_at ? new Date(item.last_tested_at).toLocaleString() : "Nunca"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link aria-label={`Ver ${item.name}`} className="icon-button" to={`/connections/${item.id}`}><Eye className="size-4" /></Link>
                        <button aria-label={`Probar ${item.name}`} className="icon-button" disabled={retest.isPending} onClick={() => { retest.mutate(item.id); }}><RefreshCw className="size-4" /></button>
                        <Link aria-label={`Editar ${item.name}`} className="icon-button" to={`/connections/${item.id}/edit`}><Pencil className="size-4" /></Link>
                        <button aria-label={`Eliminar ${item.name}`} className="icon-button text-red-600" disabled={remove.isPending} onClick={() => { confirmDelete(item.id, item.name); }}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </PageSection>
    </PageContainer>
  );
}
