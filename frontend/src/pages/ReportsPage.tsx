import { FilePlus2 } from "lucide-react";
import { Link } from "react-router";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportsFilters } from "../features/reports/components/ReportsFilters";
import { ReportsList } from "../features/reports/components/ReportsList";
import { useReportsPage } from "../features/reports/hooks/useReportsPage";

export function ReportsPage() {
  const page = useReportsPage();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reportes reutilizables"
        title="Reportes"
        description="Presenta y exporta consultas guardadas sin ejecutar SQL libre."
        actions={
          <Link className="btn-primary" to="/reports/new">
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
          onAction={(id, name) => {
            page.action.mutate({ id, name });
          }}
          onConfirmAction={page.confirmAction}
        />
      ) : null}
    </PageContainer>
  );
}
