import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, GitFork, Pencil, RefreshCw, TableProperties, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import {
  deleteConnection,
  getConnection,
  retestConnection,
} from "../features/connections/api/connectionsApi";
import { useAuth } from "../features/auth/context";
import { listConnectionAccess } from "../features/auth/api/authApi";
import { routes } from "../app/router/routes";
import { returnState } from "../shared/navigation/navigationState";
import { useReturnNavigation } from "../shared/hooks/useReturnNavigation";

export function ConnectionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { returnTo } = useReturnNavigation(routes.connections.list());
  const query = useQuery({
    queryKey: ["connection", id],
    queryFn: () => getConnection(id),
    enabled: Boolean(id),
  });
  const retest = useMutation({
    mutationFn: () => retestConnection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connection", id] });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteConnection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
      void navigate(returnTo);
    },
  });
  const access = useQuery({
    queryKey: ["connection-access", id],
    queryFn: () => listConnectionAccess(id),
    enabled: auth.hasPermission("connections.manage_access"),
  });

  if (query.isPending)
    return (
      <PageContainer>
        <p className="state-message">Cargando conexión…</p>
      </PageContainer>
    );
  if (query.isError)
    return (
      <PageContainer>
        <p className="alert-error">No fue posible cargar la conexión.</p>
      </PageContainer>
    );
  const connection = query.data;
  return (
    <PageContainer>
      <PageHeader
        title={connection.name}
        description={`${connection.host}:${String(connection.port)} · ${connection.database_name}`}
        backAction={{ fallback: routes.connections.list(), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Conexiones", to: routes.connections.list() },
          { label: connection.name },
        ]}
        actions={
          <>
            <Link
              className="btn-primary"
              state={returnState(location)}
              to={routes.connections.schema(id)}
            >
              <TableProperties className="size-4" /> Explorar esquema
            </Link>
            <Link
              className="btn-secondary"
              state={returnState(location)}
              to={routes.connections.relationships(id)}
            >
              <GitFork className="size-4" /> Relaciones
            </Link>
            <Link
              className="btn-secondary"
              state={returnState(location)}
              to={routes.connections.semanticCatalog(id)}
            >
              <BookOpenText className="size-4" /> Semántica
            </Link>
            <DropdownMenu
              label="Más acciones"
              items={[
                {
                  label: retest.isPending ? "Probando conexión…" : "Probar conexión",
                  disabled: retest.isPending,
                  icon: (
                    <RefreshCw className={`size-4 ${retest.isPending ? "animate-spin" : ""}`} />
                  ),
                  onSelect: () => {
                    retest.mutate();
                  },
                },
                {
                  label: "Editar conexión",
                  icon: <Pencil className="size-4" />,
                  onSelect: () => {
                    void navigate(routes.connections.edit(id), { state: returnState(location) });
                  },
                },
                {
                  label: "Eliminar conexión",
                  danger: true,
                  disabled: remove.isPending,
                  icon: <Trash2 className="size-4" />,
                  onSelect: () => {
                    if (window.confirm("¿Eliminar esta configuración local?")) remove.mutate();
                  },
                },
              ]}
            />
          </>
        }
      />
      {(location.state as { message?: string } | null)?.message ? (
        <p className="alert-success">{(location.state as { message: string }).message}</p>
      ) : null}
      {retest.isError ? <p className="alert-error">{retest.error.message}</p> : null}
      <PageSection title="Información general">
        <dl className="detail-grid">
          <Detail label="Estado">
            <StatusBadge variant={connection.status === "connected" ? "success" : "warning"}>
              {connection.status}
            </StatusBadge>
          </Detail>
          <Detail label="Motor">{connection.engine}</Detail>
          <Detail label="Proveedor">{connection.provider}</Detail>
          <Detail label="Host">{connection.host}</Detail>
          <Detail label="Puerto">{connection.port}</Detail>
          <Detail label="Base">{connection.database_name}</Detail>
          <Detail label="Usuario">{connection.username}</Detail>
          <Detail label="SSL">{connection.ssl_enabled ? "Activado" : "Desactivado"}</Detail>
        </dl>
      </PageSection>
      <PageSection title="Servidor">
        <dl className="detail-grid">
          <Detail label="Versión">{connection.raw_version ?? "No detectada"}</Detail>
          <Detail label="Comentario">{connection.version_comment ?? "No informado"}</Detail>
          <Detail label="Character set">{connection.character_set ?? "No informado"}</Detail>
          <Detail label="Collation">{connection.collation ?? "No informada"}</Detail>
          <Detail label="Zona horaria">{connection.timezone ?? "No informada"}</Detail>
          <Detail breakAnywhere label="SQL mode">
            {connection.sql_mode || "No informado"}
          </Detail>
          <Detail label="Última prueba">
            {connection.last_tested_at
              ? new Date(connection.last_tested_at).toLocaleString()
              : "Nunca"}
          </Detail>
          <Detail label="Último error">{connection.last_error_message ?? "Ninguno"}</Detail>
        </dl>
      </PageSection>
      <PageSection title="Capacidades detectadas">
        <div className="flex flex-wrap gap-2">
          {Object.entries(connection.capabilities).map(([name, enabled]) => (
            <StatusBadge key={name} variant={enabled ? "success" : "neutral"}>
              {name.replaceAll("_", " ")}
            </StatusBadge>
          ))}
        </div>
      </PageSection>
      {auth.hasPermission("connections.manage_access") ? (
        <PageSection title="Acceso">
          <p className="mb-4 text-sm text-slate-500">
            Acceso específico por conexión. Los permisos globales siguen siendo obligatorios.
          </p>
          {access.isPending ? (
            <p>Cargando acceso…</p>
          ) : (
            <div className="grid gap-2">
              {access.data?.map((item) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={item.user_id}
                >
                  <div>
                    <strong>{item.full_name}</strong>
                    <p className="text-xs text-slate-500">
                      {item.email} · {item.roles.join(", ")}
                    </p>
                  </div>
                  <StatusBadge>{item.access_level}</StatusBadge>
                </div>
              ))}
              {access.data?.length === 0 ? (
                <p className="text-sm text-slate-500">No hay accesos explícitos.</p>
              ) : null}
            </div>
          )}
        </PageSection>
      ) : null}
    </PageContainer>
  );
}

function Detail({
  breakAnywhere = false,
  label,
  children,
}: {
  breakAnywhere?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={breakAnywhere ? "break-all" : undefined}>{children}</dd>
    </div>
  );
}
