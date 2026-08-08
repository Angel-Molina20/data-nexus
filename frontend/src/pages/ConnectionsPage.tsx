import { Plus } from "lucide-react";
import { Link } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { ConnectionsFilters } from "../features/connections/components/ConnectionsFilters";
import { ConnectionsTable } from "../features/connections/components/ConnectionsTable";
import { useConnectionsPage } from "../features/connections/hooks/useConnectionsPage";

export function ConnectionsPage() {
  const page = useConnectionsPage();

  return (
    <PageContainer>
      <PageHeader
        title="Conexiones"
        description="Administra de forma segura las fuentes MySQL disponibles."
        actions={
          <Link className="btn-primary" to="/connections/new">
            <Plus aria-hidden="true" className="size-4" />
            Nueva conexión
          </Link>
        }
      />
      <ConnectionsFilters
        search={page.filters.search}
        status={page.filters.status}
        onSearchChange={page.setSearch}
        onStatusChange={page.setStatus}
      />
      <PageSection>
        {page.connections.isPending ? <p className="state-message">Cargando conexiones…</p> : null}
        {page.connections.isError ? (
          <p className="state-message text-red-700">No fue posible cargar las conexiones.</p>
        ) : null}
        {page.connections.data ? (
          <ConnectionsTable
            connections={page.connections.data.items}
            isDeleting={page.isDeleting}
            isRetesting={page.isRetesting}
            onDelete={page.requestDelete}
            onRetest={page.retestConnection}
          />
        ) : null}
      </PageSection>
    </PageContainer>
  );
}
