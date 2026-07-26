import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import { listSchemaSynchronizations } from "../services/schema";

export function SchemaSynchronizationsPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["schema-synchronizations", id],
    queryFn: () => listSchemaSynchronizations(id),
  });
  return (
    <PageContainer>
      <PageHeader
        title="Historial de sincronizaciones"
        description="Ejecuciones, conteos, cambios y errores seguros del catálogo."
        actions={<Link className="btn-secondary" to={`/connections/${id}/schema`}><ArrowLeft className="size-4" /> Volver al esquema</Link>}
      />
      <PageSection>
        {query.isPending ? <p className="state-message">Cargando historial…</p> : null}
        {query.isError ? <p className="alert-error">No fue posible cargar el historial.</p> : null}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Estado</th><th>Duración</th><th>Entidades</th><th>Campos</th><th>Índices</th><th>Relaciones</th><th>Cambios</th></tr></thead>
            <tbody>{query.data?.items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.started_at).toLocaleString()}</td>
                <td><StatusBadge variant={item.status === "completed" ? "success" : item.status === "failed" ? "warning" : "info"}>{item.status}</StatusBadge>{item.error_message ? <small>{item.error_message}</small> : null}</td>
                <td>{item.duration_ms === null ? "—" : `${String(item.duration_ms)} ms`}</td>
                <td>{item.entities_discovered}</td><td>{item.fields_discovered}</td>
                <td>{item.indexes_discovered}</td><td>{item.relationships_discovered}</td>
                <td>+{item.entities_added + item.fields_added} ~{item.entities_updated + item.fields_updated} −{item.entities_removed + item.fields_removed}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </PageSection>
    </PageContainer>
  );
}
