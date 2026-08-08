import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { ConnectionFields } from "../features/connections/ConnectionFields";
import { editConnectionSchema } from "../features/connections/schema";
import type { ConnectionFormData } from "../features/connections/types";
import { getConnection, updateConnection } from "../features/connections/api/connectionsApi";
import { routes } from "../app/router/routes";
import { useReturnNavigation } from "../shared/hooks/useReturnNavigation";
import { useUnsavedChangesGuard } from "../shared/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "../components/navigation/UnsavedChangesDialog";

export function EditConnectionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { returnTo } = useReturnNavigation(routes.connections.detail(id));
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const query = useQuery({
    queryKey: ["connection", id],
    queryFn: () => getConnection(id),
    enabled: Boolean(id),
  });
  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(editConnectionSchema),
    defaultValues: {
      name: "",
      engine: "mysql",
      host: "",
      port: 3306,
      database_name: "",
      username: "",
      password: "",
      ssl_enabled: false,
      configuration: {},
    },
  });
  useEffect(() => {
    if (query.data && !initialized.current) {
      form.reset({
        name: query.data.name,
        engine: "mysql",
        host: query.data.host,
        port: query.data.port,
        database_name: query.data.database_name,
        username: query.data.username,
        password: "",
        ssl_enabled: query.data.ssl_enabled,
        configuration: query.data.configuration,
      });
      initialized.current = true;
    }
  }, [form, query.data]);
  const technical =
    form.formState.dirtyFields.host ||
    form.formState.dirtyFields.port ||
    form.formState.dirtyFields.database_name ||
    form.formState.dirtyFields.username ||
    form.formState.dirtyFields.password ||
    form.formState.dirtyFields.ssl_enabled;
  const unsaved = useUnsavedChangesGuard(form.formState.isDirty);
  const update = useMutation({
    mutationFn: (data: ConnectionFormData) => {
      const payload: Partial<ConnectionFormData> = { ...data };
      if (!data.password) delete payload.password;
      return updateConnection(id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
      form.reset(form.getValues());
      unsaved.navigateWithoutPrompt(() => {
        const detailPath = routes.connections.detail(id);
        void navigate(routes.connections.detail(id), {
          state: {
            ...(returnTo !== detailPath ? { from: returnTo } : {}),
            message: "Conexión actualizada.",
          },
        });
      });
    },
  });
  if (query.isPending)
    return (
      <PageContainer>
        <p className="state-message">Cargando…</p>
      </PageContainer>
    );
  return (
    <PageContainer>
      <PageHeader
        title="Editar conexión"
        description="Los cambios técnicos se prueban antes de guardarse."
        backAction={{ fallback: routes.connections.detail(id), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Conexiones", to: routes.connections.list() },
          { label: query.data?.name ?? "Conexión", to: routes.connections.detail(id) },
          { label: "Editar" },
        ]}
      />
      <PageSection>
        <form
          className="grid gap-7"
          onSubmit={(event) => {
            void form.handleSubmit((data) => {
              update.mutate(data);
            })(event);
          }}
        >
          <ConnectionFields
            register={form.register}
            errors={form.formState.errors}
            passwordOptional
          />
          {update.isError ? <p className="alert-error">{update.error.message}</p> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Link className="btn-secondary" to={returnTo}>
              Cancelar
            </Link>
            <button className="btn-primary" disabled={update.isPending} type="submit">
              {update.isPending
                ? "Probando y actualizando…"
                : technical
                  ? "Probar y guardar cambios"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </PageSection>
      <UnsavedChangesDialog
        onLeave={unsaved.leave}
        onStay={unsaved.stay}
        open={unsaved.isBlocked}
      />
    </PageContainer>
  );
}
