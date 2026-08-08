import { FilePlus2 } from "lucide-react";
import { Link, useLocation } from "react-router";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportsFilters } from "../features/reports/components/ReportsFilters";
import { ReportsList } from "../features/reports/components/ReportsList";
import { useReportsPage } from "../features/reports/hooks/useReportsPage";
import { Pagination } from "../components/ui/Pagination";
import { returnState } from "../shared/navigation/navigationState";
import { routes } from "../app/router/routes";

export function ReportsPage() {
  const page = useReportsPage();
  const location = useLocation();
  const origin = returnState(location);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reportes reutilizables"
        title="Reportes"
        description="Presenta y exporta consultas guardadas sin ejecutar SQL libre."
        actions={
          <Link className="btn-primary" state={origin} to={routes.reports.create()}>
            <FilePlus2 className="size-4" />
            Crear reporte
          </Link>
        }
      />
      <ReportsFilters
        search={page.filters.search}
        status={page.filters.status}
        onSearchChange={page.setSearch}
        onStatusChange={page.setStatus}
      />
      {page.reports.isPending ? <p className="state-message">Cargando reportes…</p> : null}
      {page.reports.isError ? (
        <p className="alert-error">No fue posible cargar los reportes.</p>
      ) : null}
      {page.reports.data ? (
        <ReportsList
          reports={page.reports.data.items}
          navigationState={origin}
          onAction={(id, name) => {
            page.action.mutate({ id, name });
          }}
          onConfirmAction={page.confirmAction}
        />
      ) : null}
      {page.reports.data ? (
        <Pagination
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
          page={page.reports.data.page}
          pageSize={page.reports.data.page_size}
          pageSizes={[20, 50, 100]}
          totalPages={Math.max(1, Math.ceil(page.reports.data.total / page.reports.data.page_size))}
        />
      ) : null}
    </PageContainer>
  );
}
