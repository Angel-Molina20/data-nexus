import { Database, FileBarChart, PlayCircle, SearchCode } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { StatusIndicator } from "../../../components/ui/StatusIndicator";
import { formatDuration, formatNumber, formatRelativeDate } from "../../../shared/utils/formatters";
import type { DashboardSummary } from "../types";
import { RecentResourcePanel } from "./RecentResourcePanel";
import { returnState } from "../../../shared/navigation/navigationState";

const executionVariants: Record<string, BadgeVariant> = {
  completed: "success",
  failed: "danger",
  cancelled: "danger",
  timed_out: "warning",
  pending: "info",
  running: "info",
};

const statusLabels: Record<string, string> = {
  connected: "Disponible",
  disconnected: "Desconectada",
  error: "Error",
  testing: "Verificando",
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
  completed: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
  timed_out: "Tiempo agotado",
  pending: "Pendiente",
  running: "Ejecutando",
};

function ResourceIcon({ children }: { children: ReactNode }) {
  return <span className="rounded-lg bg-surface-muted p-2 text-primary">{children}</span>;
}

export function DashboardRecentContent({
  data,
  hasPermission,
}: {
  data: DashboardSummary;
  hasPermission: (permission: string) => boolean;
}) {
  const origin = returnState(useLocation());
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {data.queries.available ? (
        <RecentResourcePanel
          emptyAction={
            hasPermission("queries.create") ? (
              <DashboardLink to="/queries/new">Crear consulta</DashboardLink>
            ) : undefined
          }
          emptyDescription="Aún no tienes consultas guardadas."
          title="Consultas recientes"
          viewAllTo="/queries"
        >
          {data.queries.items.length
            ? data.queries.items.map((query) => (
                <Link
                  className="dashboard-resource-row"
                  key={query.id}
                  state={origin}
                  to={`/queries/${query.id}/builder`}
                >
                  <ResourceIcon>
                    <SearchCode aria-hidden="true" className="size-4" />
                  </ResourceIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {query.name}
                    </span>
                    <span className="text-caption mt-1 block text-muted">
                      Actualizada {formatRelativeDate(query.updated_at)}
                    </span>
                  </span>
                  <Badge variant={query.validation_status === "valid" ? "success" : "neutral"}>
                    {query.validation_status === "valid" ? "Válida" : "Sin validar"}
                  </Badge>
                </Link>
              ))
            : undefined}
        </RecentResourcePanel>
      ) : null}

      {data.executions.available ? (
        <RecentResourcePanel
          emptyDescription="No hay ejecuciones iniciadas durante las últimas 24 horas."
          title="Ejecuciones recientes"
        >
          {data.executions.items.length
            ? data.executions.items.map((execution) => (
                <div className="dashboard-resource-row" key={execution.id}>
                  <ResourceIcon>
                    <PlayCircle aria-hidden="true" className="size-4" />
                  </ResourceIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {execution.query_name ?? "Consulta temporal"}
                    </span>
                    <span className="text-caption mt-1 block text-muted">
                      {formatDuration(execution.duration_ms)} · {formatNumber(execution.row_count)}{" "}
                      filas · {formatRelativeDate(execution.started_at)}
                    </span>
                  </span>
                  <StatusIndicator
                    running={execution.status === "running" || execution.status === "pending"}
                    variant={executionVariants[execution.status] ?? "neutral"}
                  >
                    {statusLabels[execution.status] ?? execution.status}
                  </StatusIndicator>
                </div>
              ))
            : undefined}
        </RecentResourcePanel>
      ) : null}

      {data.connections.available ? (
        <RecentResourcePanel
          emptyAction={
            hasPermission("connections.create") ? (
              <DashboardLink to="/connections/new">Crear conexión</DashboardLink>
            ) : undefined
          }
          emptyDescription="No hay conexiones disponibles en tu espacio."
          title="Conexiones"
          viewAllTo="/connections"
        >
          {data.connections.items.length
            ? data.connections.items.map((connection) => (
                <Link
                  className="dashboard-resource-row"
                  key={connection.id}
                  state={origin}
                  to={`/connections/${connection.id}`}
                >
                  <ResourceIcon>
                    <Database aria-hidden="true" className="size-4" />
                  </ResourceIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {connection.name}
                    </span>
                    <span className="text-caption mt-1 block text-muted">
                      {connection.provider} {connection.raw_version ?? "versión sin registrar"} ·
                      Actualizada {formatRelativeDate(connection.updated_at)}
                    </span>
                  </span>
                  <StatusIndicator
                    variant={
                      connection.status === "connected"
                        ? "success"
                        : connection.status === "error"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {statusLabels[connection.status] ?? connection.status}
                  </StatusIndicator>
                </Link>
              ))
            : undefined}
        </RecentResourcePanel>
      ) : null}

      {data.reports.available ? (
        <RecentResourcePanel
          emptyAction={
            hasPermission("reports.create") ? (
              <DashboardLink to="/reports/new">Crear reporte</DashboardLink>
            ) : undefined
          }
          emptyDescription="Aún no tienes reportes activos."
          title="Reportes recientes"
          viewAllTo="/reports"
        >
          {data.reports.items.length
            ? data.reports.items.map((report) => (
                <Link
                  className="dashboard-resource-row"
                  key={report.id}
                  state={origin}
                  to={`/reports/${report.id}`}
                >
                  <ResourceIcon>
                    <FileBarChart aria-hidden="true" className="size-4" />
                  </ResourceIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {report.name}
                    </span>
                    <span className="text-caption mt-1 block text-muted">
                      {report.query_name ?? "Consulta no disponible"} · Actualizado{" "}
                      {formatRelativeDate(report.updated_at)}
                    </span>
                  </span>
                  <Badge variant={report.status === "published" ? "success" : "neutral"}>
                    {statusLabels[report.status] ?? report.status}
                  </Badge>
                </Link>
              ))
            : undefined}
        </RecentResourcePanel>
      ) : null}
    </div>
  );
}

function DashboardLink({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link className="text-sm font-semibold text-primary hover:underline" to={to}>
      {children}
    </Link>
  );
}
