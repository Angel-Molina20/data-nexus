import { useQuery } from "@tanstack/react-query";
import { Database, ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "../components/feedback/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { listConnections } from "../services/connections";

export function SchemaIndexPage() {
  const query = useQuery({
    queryKey: ["connections", "schema-selector"],
    queryFn: () => listConnections({ page: 1 }),
  });
  return (
    <PageContainer>
      <PageHeader
        title="Explorador de esquemas"
        description="Selecciona una conexión para sincronizar y explorar sus metadatos."
      />
      <PageSection>
        {query.isPending ? <p className="state-message">Cargando conexiones…</p> : null}
        {query.isError ? <p className="alert-error">No fue posible cargar las conexiones.</p> : null}
        {query.data?.items.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No hay conexiones disponibles"
            description="Registra primero una conexión MySQL para explorar su esquema."
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {query.data?.items.map((connection) => (
            <Link
              className="flex items-center justify-between rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50/40"
              key={connection.id}
              to={`/connections/${connection.id}/schema`}
            >
              <div>
                <strong className="text-slate-900">{connection.name}</strong>
                <p className="mt-1 text-sm text-slate-500">
                  {connection.provider} · {connection.raw_version ?? "Versión no detectada"}
                </p>
              </div>
              <ExternalLink aria-hidden="true" className="size-5 text-blue-600" />
            </Link>
          ))}
        </div>
      </PageSection>
    </PageContainer>
  );
}
