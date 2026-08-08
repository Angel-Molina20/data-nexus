import { useQuery } from "@tanstack/react-query";
import { Code2, FileJson2, Network } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import { getQuery } from "../features/queries/api/queriesApi";
import { useAuth } from "../features/auth/context";
import { routes } from "../app/router/routes";
import { returnState } from "../shared/navigation/navigationState";

export function QueryDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const origin = returnState(location);
  const query = useQuery({ queryKey: ["query", id], queryFn: () => getQuery(id) });
  if (query.isPending)
    return (
      <PageContainer>
        <p className="state-message">Cargando consulta…</p>
      </PageContainer>
    );
  if (query.isError)
    return (
      <PageContainer>
        <p className="alert-error">No fue posible cargar la consulta.</p>
      </PageContainer>
    );
  const item = query.data;
  const body = item.document.query;
  const source = body.source;
  const limit = typeof body.limit === "number" ? body.limit : "Sin declarar";
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`AST ${item.schema_version}`}
        title={item.name}
        description={item.description || "Borrador universal sin descripción."}
        backAction={{ fallback: routes.queries.list(), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Consultas", to: routes.queries.list() },
          { label: item.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Link className="btn-primary" state={origin} to={routes.queries.builder(item.id)}>
              <Network className="size-4" />
              Constructor
            </Link>
            {hasPermission("queries.compile") && item.validation_status === "valid" ? (
              <Link className="btn-secondary" state={origin} to={routes.queries.compile(item.id)}>
                <Code2 className="size-4" />
                Compilar
              </Link>
            ) : null}
            {hasPermission("queries.update") ? (
              <Link className="btn-secondary" state={origin} to={routes.queries.editJson(item.id)}>
                <FileJson2 className="size-4" />
                Editar JSON
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <StatusBadge>{item.status}</StatusBadge>
        <StatusBadge variant={item.validation_status === "valid" ? "success" : "warning"}>
          {item.validation_status}
        </StatusBadge>
        <StatusBadge>Revisión {item.revision}</StatusBadge>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <PageSection title="Estructura">
          <dl className="detail-grid">
            <div>
              <dt>Fuente principal</dt>
              <dd>{typeof source.alias === "string" ? source.alias : "—"}</dd>
            </div>
            <div>
              <dt>Selecciones</dt>
              <dd>{Array.isArray(body.select) ? body.select.length : 0}</dd>
            </div>
            <div>
              <dt>Joins</dt>
              <dd>{Array.isArray(body.joins) ? body.joins.length : 0}</dd>
            </div>
            <div>
              <dt>Unions</dt>
              <dd>{Array.isArray(body.unions) ? body.unions.length : 0}</dd>
            </div>
            <div>
              <dt>Distinct</dt>
              <dd>{body.distinct ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Límite</dt>
              <dd>{limit}</dd>
            </div>
          </dl>
        </PageSection>
        <PageSection title="Análisis">
          <dl className="detail-grid">
            <div>
              <dt>Complejidad</dt>
              <dd>{item.complexity?.level ?? "Sin calcular"}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>{item.complexity?.score ?? "—"}</dd>
            </div>
            <div>
              <dt>Fingerprint</dt>
              <dd className="break-all font-mono text-xs">{item.fingerprint ?? "Sin validar"}</dd>
            </div>
            <div>
              <dt>Última validación</dt>
              <dd>
                {item.last_validated_at
                  ? new Date(item.last_validated_at).toLocaleString()
                  : "Nunca"}
              </dd>
            </div>
          </dl>
        </PageSection>
      </div>
      <PageSection title="Documento universal">
        <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-5 text-xs text-slate-100">
          {JSON.stringify(item.document, null, 2)}
        </pre>
      </PageSection>
    </PageContainer>
  );
}
