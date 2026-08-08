import { Database, FileBarChart, PlayCircle, SearchCode, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/FeedbackStates";
import { formatNumber } from "../../../shared/utils/formatters";
import type { DashboardSummary } from "../types";

interface Stat {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number | null;
}

export function DashboardStats({ data, loading }: { data?: DashboardSummary; loading: boolean }) {
  const stats: Stat[] = [
    data?.connections.available
      ? {
          label: "Conexiones",
          value: data.connections.total,
          detail: `${formatNumber(data.connections.connected ?? 0)} disponibles según la última prueba`,
          icon: Database,
        }
      : null,
    data?.queries.available
      ? {
          label: "Consultas guardadas",
          value: data.queries.total,
          detail: "Accesibles en tu espacio de trabajo",
          icon: SearchCode,
        }
      : null,
    data?.executions.available
      ? {
          label: "Ejecuciones",
          value: data.executions.last_24_hours,
          detail: "Iniciadas durante las últimas 24 horas",
          icon: PlayCircle,
        }
      : null,
    data?.reports.available
      ? {
          label: "Reportes activos",
          value: data.reports.total,
          detail: `${formatNumber(data.reports.published ?? 0)} publicados; archivados excluidos`,
          icon: FileBarChart,
        }
      : null,
  ].filter((stat) => stat !== null);

  if (loading) {
    return (
      <section aria-label="Cargando resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-9 w-20" />
              <Skeleton className="mt-4 h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="Resumen de recursos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ detail, icon: Icon, label, value }) => (
        <Card className="dashboard-stat-card" key={label}>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-label text-muted">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                  {value === null ? "—" : formatNumber(value)}
                </p>
              </div>
              <span className="rounded-lg bg-blue-50 p-2.5 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </div>
            <p className="text-caption mt-3 text-muted">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
