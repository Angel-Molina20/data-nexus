import { RefreshCw } from "lucide-react";

import { BackendStatus } from "../../../components/feedback/BackendStatus";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import type { BackendStatusValue } from "../../../shared/api/health";

interface DashboardHeaderProps {
  backendStatus: BackendStatusValue;
  fullName: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function DashboardHeader({
  backendStatus,
  fullName,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  const firstName = fullName.trim().split(/\s+/)[0];
  return (
    <PageHeader
      eyebrow="Centro de trabajo"
      title={firstName ? `Bienvenido, ${firstName}` : "Bienvenido a DataNexus"}
      description="Supervisa tus recursos recientes y continúa tu trabajo desde un solo lugar."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <BackendStatus status={backendStatus} />
          <Button
            aria-label="Actualizar dashboard"
            loading={isRefreshing}
            onClick={onRefresh}
            size="sm"
            startIcon={<RefreshCw className="size-4" />}
            variant="secondary"
          >
            Actualizar
          </Button>
        </div>
      }
    />
  );
}
