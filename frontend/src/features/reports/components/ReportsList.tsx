import { Archive, Eye, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Report } from "../types";
import type { ReportAction } from "../hooks/useReportsPage";
import type { ReturnNavigationState } from "../../../shared/navigation/navigationState";
import { routes } from "../../../app/router/routes";

interface ReportsListProps {
  reports: Report[];
  onAction: (id: string, action: ReportAction) => void;
  onConfirmAction: (id: string, action: "archive" | "delete") => void;
  navigationState: ReturnNavigationState;
}
export function ReportsList({
  reports,
  onAction,
  onConfirmAction,
  navigationState,
}: ReportsListProps) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      {reports.map((report) => (
        <article
          className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_auto] lg:items-center"
          key={report.id}
        >
          <div>
            <div className="flex gap-2">
              <strong>{report.name}</strong>
              <StatusBadge variant={report.status === "published" ? "success" : "info"}>
                {report.status}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{report.description || report.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              Consulta {report.query_id.slice(0, 8)} · revisión {report.query_revision} ·{" "}
              {new Date(report.updated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="btn-secondary"
              state={navigationState}
              to={routes.reports.detail(report.id)}
            >
              <Eye className="size-4" />
              Abrir
            </Link>
            <Link
              className="btn-secondary"
              state={navigationState}
              to={routes.reports.edit(report.id)}
            >
              Editar
            </Link>
            {report.status === "draft" ? (
              <button
                className="btn-primary"
                onClick={() => {
                  onAction(report.id, "publish");
                }}
              >
                Publicar
              </button>
            ) : null}
            {report.status !== "archived" ? (
              <button
                className="icon-button"
                aria-label="Archivar"
                onClick={() => {
                  onConfirmAction(report.id, "archive");
                }}
              >
                <Archive className="size-4" />
              </button>
            ) : null}
            <button
              className="icon-button text-red-600"
              aria-label="Eliminar"
              onClick={() => {
                onConfirmAction(report.id, "delete");
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </article>
      ))}
      {reports.length === 0 ? <p className="state-message">Aún no hay reportes.</p> : null}
    </section>
  );
}
