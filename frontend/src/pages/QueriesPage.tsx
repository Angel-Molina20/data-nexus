import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Code2, Copy, FileJson2, Network, Plus, Trash2 } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../features/auth/context";
import { Pagination } from "../components/ui/Pagination";
import { routes } from "../app/router/routes";
import { returnState } from "../shared/navigation/navigationState";
import {
  archiveQuery,
  deleteQuery,
  duplicateQuery,
  listQueries,
  validateSavedQuery,
} from "../features/queries/api/queriesApi";

export function QueriesPage() {
  const client = useQueryClient();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("page_size"), 25);
  const origin = returnState(location);
  const query = useQuery({
    queryKey: ["queries", page, pageSize],
    queryFn: () => listQueries(page, pageSize),
  });
  const mutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      if (action === "validate") await validateSavedQuery(id);
      else if (action === "duplicate") await duplicateQuery(id);
      else if (action === "archive") await archiveQuery(id);
      else await deleteQuery(id);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["queries"] });
    },
  });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Constructor visual"
        title="Consultas"
        description="Diseña consultas como AST universal y obtén una vista SQL parametrizada sin ejecutar datos."
        actions={
          hasPermission("queries.create") ? (
            <Link className="btn-primary" state={origin} to={routes.queries.create()}>
              <Plus className="size-4" />
              Nueva consulta
            </Link>
          ) : null
        }
      />
      {query.isPending ? (
        <p className="state-message">Cargando consultas…</p>
      ) : query.isError ? (
        <p className="alert-error">No fue posible cargar los borradores.</p>
      ) : query.data.items.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white p-12 text-center">
          <Network className="mx-auto size-10 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold">Aún no hay consultas</h2>
          <p className="mt-1 text-sm text-slate-500">Crea una consulta visual sin escribir SQL.</p>
        </section>
      ) : (
        <div className="grid gap-4">
          {query.data.items.map((item) => (
            <article className="rounded-xl border bg-white p-5 shadow-sm" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      className="font-semibold text-slate-900 hover:text-blue-700"
                      state={origin}
                      to={routes.queries.detail(item.id)}
                    >
                      {item.name}
                    </Link>
                    <StatusBadge
                      variant={
                        item.validation_status === "valid"
                          ? "success"
                          : item.validation_status === "invalid"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {item.validation_status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.description || "Sin descripción"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Revisión {item.revision} · {new Date(item.updated_at).toLocaleString()} ·
                    Complejidad {item.complexity?.level ?? "sin calcular"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    aria-label="Abrir constructor"
                    className="btn-secondary"
                    title="Abrir constructor"
                    state={origin}
                    to={routes.queries.builder(item.id)}
                  >
                    <Network className="size-4" />
                  </Link>
                  {hasPermission("queries.update") ? (
                    <Link
                      aria-label="Editar JSON"
                      className="btn-secondary"
                      title="Editar JSON"
                      state={origin}
                      to={routes.queries.editJson(item.id)}
                    >
                      <FileJson2 className="size-4" />
                    </Link>
                  ) : null}
                  {hasPermission("queries.compile") && item.validation_status === "valid" ? (
                    <Link
                      aria-label="Compilar"
                      className="btn-secondary"
                      title="Compilar"
                      state={origin}
                      to={routes.queries.compile(item.id)}
                    >
                      <Code2 className="size-4" />
                    </Link>
                  ) : null}
                  {hasPermission("queries.validate") ? (
                    <button
                      aria-label="Validar"
                      className="btn-secondary"
                      title="Validar"
                      onClick={() => {
                        mutation.mutate({ id: item.id, action: "validate" });
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                  ) : null}
                  <button
                    aria-label="Duplicar"
                    className="btn-secondary"
                    title="Duplicar"
                    onClick={() => {
                      mutation.mutate({ id: item.id, action: "duplicate" });
                    }}
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    aria-label="Archivar"
                    className="btn-secondary"
                    title="Archivar"
                    onClick={() => {
                      mutation.mutate({ id: item.id, action: "archive" });
                    }}
                  >
                    <Archive className="size-4" />
                  </button>
                  <button
                    aria-label="Eliminar"
                    className="btn-danger"
                    title="Eliminar"
                    onClick={() => {
                      if (window.confirm("¿Eliminar este borrador?"))
                        mutation.mutate({ id: item.id, action: "delete" });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {query.data ? (
        <Pagination
          onPageChange={(nextPage) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("page", String(nextPage));
              return next;
            });
          }}
          onPageSizeChange={(nextPageSize) => {
            setSearchParams({ page: "1", page_size: String(nextPageSize) });
          }}
          page={query.data.page}
          pageSize={query.data.page_size}
          pageSizes={[25, 50, 100]}
          totalPages={Math.max(1, Math.ceil(query.data.total / query.data.page_size))}
        />
      ) : null}
    </PageContainer>
  );
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
