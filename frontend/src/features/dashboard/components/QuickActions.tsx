import { Database, FilePlus2, SearchCode } from "lucide-react";
import { Link, useLocation } from "react-router";
import { returnState } from "../../../shared/navigation/navigationState";

interface QuickActionsProps {
  hasPermission: (permission: string) => boolean;
}

export function QuickActions({ hasPermission }: QuickActionsProps) {
  const origin = returnState(useLocation());
  const canCreateQuery = hasPermission("queries.create");
  const actions = [
    canCreateQuery
      ? {
          label: "Nueva consulta",
          to: "/queries/new",
          icon: SearchCode,
          variant: "primary" as const,
        }
      : null,
    hasPermission("connections.create")
      ? {
          label: "Nueva conexión",
          to: "/connections/new",
          icon: Database,
          variant: "secondary" as const,
        }
      : null,
    hasPermission("reports.create")
      ? {
          label: "Nuevo reporte",
          to: "/reports/new",
          icon: FilePlus2,
          variant: "secondary" as const,
        }
      : null,
  ].filter((action) => action !== null);

  if (actions.length === 0) return null;

  return (
    <nav aria-label="Acciones rápidas" className="flex flex-wrap gap-2">
      {actions.map(({ icon: Icon, label, to, variant }) => (
        <Link
          className={
            variant === "primary"
              ? "inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
              : "inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          }
          key={to}
          state={origin}
          to={to}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
