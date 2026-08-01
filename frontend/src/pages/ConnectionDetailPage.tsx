import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, GitFork, Pencil, RefreshCw, TableProperties, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import { deleteConnection, getConnection, retestConnection } from "../services/connections";
import { useAuth } from "../features/auth/context";
import { listConnectionAccess } from "../services/auth";

export function ConnectionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const query = useQuery({ queryKey: ["connection", id], queryFn: () => getConnection(id), enabled: Boolean(id) });
  const retest = useMutation({ mutationFn: () => retestConnection(id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["connection", id] }); } });
  const remove = useMutation({ mutationFn: () => deleteConnection(id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["connections"] }); void navigate("/connections"); } });
  const access = useQuery({ queryKey: ["connection-access", id], queryFn: () => listConnectionAccess(id), enabled: auth.hasPermission("connections.manage_access") });

  if (query.isPending) return <PageContainer><p className="state-message">Cargando conexión…</p></PageContainer>;
  if (query.isError) return <PageContainer><p className="alert-error">No fue posible cargar la conexión.</p></PageContainer>;
  const connection = query.data;
  return (
    <PageContainer>
      <PageHeader
        title={connection.name}
        description={`${connection.host}:${String(connection.port)} · ${connection.database_name}`}
        actions={<><Link className="btn-primary" to={`/connections/${id}/schema`}><TableProperties className="size-4" /> Explorar esquema</Link><Link className="btn-secondary" to={`/connections/${id}/relationships`}><GitFork className="size-4" /> Relaciones</Link><Link className="btn-secondary" to={`/connections/${id}/semantic-catalog`}><BookOpenText className="size-4" /> Semántica</Link><button className="btn-secondary" disabled={retest.isPending} onClick={() => { retest.mutate(); }}><RefreshCw className="size-4" />{retest.isPending ? "Probando…" : "Probar"}</button><Link className="btn-secondary" to={`/connections/${id}/edit`}><Pencil className="size-4" /> Editar</Link><button className="btn-danger" disabled={remove.isPending} onClick={() => { if (window.confirm("¿Eliminar esta configuración local?")) remove.mutate(); }}><Trash2 className="size-4" /> Eliminar</button></>}
      />
      {(location.state as { message?: string } | null)?.message ? <p className="alert-success">{(location.state as { message: string }).message}</p> : null}
      {retest.isError ? <p className="alert-error">{retest.error.message}</p> : null}
      <PageSection title="Información general">
        <dl className="detail-grid">
          <Detail label="Estado"><StatusBadge variant={connection.status === "connected" ? "success" : "warning"}>{connection.status}</StatusBadge></Detail>
          <Detail label="Motor">{connection.engine}</Detail><Detail label="Proveedor">{connection.provider}</Detail>
          <Detail label="Host">{connection.host}</Detail><Detail label="Puerto">{connection.port}</Detail>
          <Detail label="Base">{connection.database_name}</Detail><Detail label="Usuario">{connection.username}</Detail>
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
          <Detail label="SQL mode">{connection.sql_mode || "No informado"}</Detail>
          <Detail label="Última prueba">{connection.last_tested_at ? new Date(connection.last_tested_at).toLocaleString() : "Nunca"}</Detail>
          <Detail label="Último error">{connection.last_error_message ?? "Ninguno"}</Detail>
        </dl>
      </PageSection>
      <PageSection title="Capacidades detectadas">
        <div className="flex flex-wrap gap-2">{Object.entries(connection.capabilities).map(([name, enabled]) => <StatusBadge key={name} variant={enabled ? "success" : "neutral"}>{name.replaceAll("_", " ")}</StatusBadge>)}</div>
      </PageSection>
      {auth.hasPermission("connections.manage_access") ? <PageSection title="Acceso"><p className="mb-4 text-sm text-slate-500">Acceso específico por conexión. Los permisos globales siguen siendo obligatorios.</p>{access.isPending ? <p>Cargando acceso…</p> : <div className="grid gap-2">{access.data?.map((item) => <div className="flex items-center justify-between rounded-lg border p-3" key={item.user_id}><div><strong>{item.full_name}</strong><p className="text-xs text-slate-500">{item.email} · {item.roles.join(", ")}</p></div><StatusBadge>{item.access_level}</StatusBadge></div>)}{access.data?.length === 0 ? <p className="text-sm text-slate-500">No hay accesos explícitos.</p> : null}</div>}</PageSection> : null}
    </PageContainer>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
