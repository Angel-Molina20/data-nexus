import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { ConnectionsFilters } from "../features/connections/components/ConnectionsFilters";
import { ConnectionsTable } from "../features/connections/components/ConnectionsTable";
import { useConnectionsPage } from "../features/connections/hooks/useConnectionsPage";
import { Pagination } from "../components/ui/Pagination";
import { returnState } from "../shared/navigation/navigationState";
import { routes } from "../app/router/routes";

export function ConnectionsPage() {
  const page = useConnectionsPage();
  const location = useLocation();
  const origin = returnState(location);

  return (
    <PageContainer>
      <PageHeader
        title="Conexiones"
        description="Administra de forma segura las fuentes MySQL disponibles."
        actions={
          <Link className="btn-primary" state={origin} to={routes.connections.create()}>
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
            navigationState={origin}
            onDelete={page.requestDelete}
            onRetest={page.retestConnection}
          />
        ) : null}
        {page.connections.data ? (
          <Pagination
            onPageChange={page.setPage}
            onPageSizeChange={page.setPageSize}
            page={page.connections.data.page}
            pageSize={page.connections.data.page_size}
            pageSizes={[20, 50, 100]}
            totalPages={Math.max(
              1,
              Math.ceil(page.connections.data.total / page.connections.data.page_size),
            )}
          />
        ) : null}
      </PageSection>
    </PageContainer>
  );
}
