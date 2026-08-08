import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PageContainer } from "../components/layout/PageContainer";
import type { AppOutletContext } from "../App";
import { useOutletContext } from "react-router";
import { useAuth } from "../features/auth/context";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardRecentContent } from "../features/dashboard/components/DashboardRecentContent";
import { DashboardStats } from "../features/dashboard/components/DashboardStats";
import { GettingStarted } from "../features/dashboard/components/GettingStarted";
import { QuickActions } from "../features/dashboard/components/QuickActions";
import { RecentResourcePanel } from "../features/dashboard/components/RecentResourcePanel";
import { useDashboard } from "../features/dashboard/hooks/useDashboard";

export function HomePage() {
  const { backendStatus } = useOutletContext<AppOutletContext>();
  const auth = useAuth();
  const dashboard = useDashboard();

  return (
    <PageContainer>
      <DashboardHeader
        backendStatus={backendStatus}
        fullName={auth.user?.full_name ?? ""}
        isRefreshing={dashboard.isFetching && !dashboard.isLoading}
        onRefresh={() => {
          void dashboard.refetch();
        }}
      />

      <QuickActions hasPermission={auth.hasPermission} />

      {dashboard.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                void dashboard.refetch();
              }}
              size="sm"
              variant="secondary"
            >
              Reintentar
            </Button>
          }
          description="No fue posible recuperar el resumen. Las demás áreas de DataNexus continúan disponibles desde la navegación."
          title="El dashboard no está disponible"
          variant="error"
        />
      ) : null}

      <DashboardStats data={dashboard.data} loading={dashboard.isLoading} />

      {dashboard.isLoading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <RecentResourcePanel emptyDescription="" loading title="Consultas recientes" />
          <RecentResourcePanel emptyDescription="" loading title="Ejecuciones recientes" />
          <RecentResourcePanel emptyDescription="" loading title="Conexiones" />
          <RecentResourcePanel emptyDescription="" loading title="Reportes recientes" />
        </div>
      ) : null}

      {dashboard.data?.connections.available &&
      dashboard.data.connections.total === 0 &&
      auth.hasPermission("connections.create") ? (
        <GettingStarted />
      ) : null}

      {dashboard.data ? (
        <DashboardRecentContent data={dashboard.data} hasPermission={auth.hasPermission} />
      ) : null}
    </PageContainer>
  );
}
