import { Database, Eye, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "../../../components/feedback/EmptyState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../shared/utils/formatters";
import type { ConnectionSummary } from "../types";

const statusLabels: Record<ConnectionSummary["status"], string> = {
  connected: "Conectada",
  disconnected: "Desconectada",
  error: "Error",
  testing: "Probando",
};

interface ConnectionsTableProps {
  connections: ConnectionSummary[];
  isDeleting: boolean;
  isRetesting: boolean;
  onDelete: (connectionId: string, connectionName: string) => void;
  onRetest: (connectionId: string) => void;
}

export function ConnectionsTable({
  connections,
  isDeleting,
  isRetesting,
  onDelete,
  onRetest,
}: ConnectionsTableProps) {
  if (connections.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Aún no hay conexiones registradas"
        description="Registra MySQL 5.6 o MySQL 8 para comenzar."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Conexión</th>
            <th>Servidor</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Última prueba</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <tr key={connection.id}>
              <td>
                <strong>{connection.name}</strong>
                <small>{connection.database_name}</small>
              </td>
              <td>
                {connection.host}:{connection.port}
                <small>{connection.provider}</small>
              </td>
              <td>{connection.raw_version ?? "Sin detectar"}</td>
              <td>
                <StatusBadge
                  variant={
                    connection.status === "connected"
                      ? "success"
                      : connection.status === "error"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {statusLabels[connection.status]}
                </StatusBadge>
              </td>
              <td>{formatDateTime(connection.last_tested_at)}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <Link
                    aria-label={`Ver ${connection.name}`}
                    className="icon-button"
                    to={`/connections/${connection.id}`}
                  >
                    <Eye className="size-4" />
                  </Link>
                  <button
                    aria-label={`Probar ${connection.name}`}
                    className="icon-button"
                    disabled={isRetesting}
                    onClick={() => {
                      onRetest(connection.id);
                    }}
                  >
                    <RefreshCw className="size-4" />
                  </button>
                  <Link
                    aria-label={`Editar ${connection.name}`}
                    className="icon-button"
                    to={`/connections/${connection.id}/edit`}
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    aria-label={`Eliminar ${connection.name}`}
                    className="icon-button text-red-600"
                    disabled={isDeleting}
                    onClick={() => {
                      onDelete(connection.id, connection.name);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
