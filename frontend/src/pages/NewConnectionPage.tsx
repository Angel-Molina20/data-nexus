import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, Database } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { ConnectionFields } from "../features/connections/ConnectionFields";
import { connectionSchema } from "../features/connections/schema";
import type { ConnectionFormData, TestResult } from "../features/connections/types";
import { createConnection, testConnection } from "../features/connections/api/connectionsApi";
import { routes } from "../app/router/routes";
import { useReturnNavigation } from "../shared/hooks/useReturnNavigation";
import { useUnsavedChangesGuard } from "../shared/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "../components/navigation/UnsavedChangesDialog";

const sources = ["MySQL", "PostgreSQL", "SQL Server", "Oracle", "MongoDB", "API REST", "CSV"];

export function NewConnectionPage() {
  const [step, setStep] = useState(1);
  const [tested, setTested] = useState<TestResult | null>(null);
  const navigate = useNavigate();
  const { returnTo } = useReturnNavigation(routes.connections.list());
  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
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
  const test = useMutation({
    mutationFn: testConnection,
    onSuccess: (result) => {
      setTested(result);
      setStep(3);
    },
  });
  const unsaved = useUnsavedChangesGuard(form.formState.isDirty);
  const create = useMutation({
    mutationFn: createConnection,
    onSuccess: (result) => {
      unsaved.navigateWithoutPrompt(() => {
        void navigate(routes.connections.detail(result.id), {
          state: { from: returnTo, message: "Conexión creada correctamente." },
        });
      });
    },
  });
  useEffect(() => {
    const subscription = form.watch(() => {
      setTested(null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [form]);

  const continueConfiguration = form.handleSubmit((data) => {
    test.mutate(data);
  });

  return (
    <PageContainer>
      <PageHeader
        title="Nueva conexión"
        description="Conecta una fuente MySQL en tres pasos seguros."
        eyebrow={`Paso ${String(step)} de 3`}
        backAction={{ fallback: routes.connections.list(), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Conexiones", to: routes.connections.list() },
          { label: "Nueva conexión" },
        ]}
      />
      {step === 1 ? (
        <PageSection title="Selecciona una fuente">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source, index) => (
              <button
                key={source}
                className={`source-card ${index ? "opacity-55" : "border-blue-500 bg-blue-50"}`}
                disabled={index > 0}
                onClick={() => {
                  setStep(2);
                }}
              >
                <Database className="size-6 shrink-0" />
                <span className="min-w-0">
                  <strong className="block">{source}</strong>
                  <small className="mt-0.5 block text-muted">
                    {index ? "Próximamente" : "Disponible"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </PageSection>
      ) : null}
      {step === 2 ? (
        <PageSection title="Configuración MySQL">
          <form
            className="grid gap-7"
            onSubmit={(event) => {
              void continueConfiguration(event);
            }}
          >
            <ConnectionFields register={form.register} errors={form.formState.errors} />
            {test.isError ? <p className="alert-error">{test.error.message}</p> : null}
            <div className="flex justify-between">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setStep(1);
                }}
              >
                Atrás
              </button>
              <button className="btn-primary" disabled={test.isPending} type="submit">
                {test.isPending ? "Probando…" : "Probar y continuar"}
              </button>
            </div>
          </form>
        </PageSection>
      ) : null}
      {step === 3 && tested ? (
        <PageSection title="Prueba exitosa">
          <div className="alert-success">
            <Check className="size-5" /> Servidor disponible
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Proveedor</dt>
              <dd>{tested.server.provider}</dd>
            </div>
            <div>
              <dt>Versión</dt>
              <dd>{tested.server.raw_version}</dd>
            </div>
            <div>
              <dt>Character set</dt>
              <dd>{tested.server.character_set ?? "No informado"}</dd>
            </div>
            <div>
              <dt>Collation</dt>
              <dd>{tested.server.collation ?? "No informado"}</dd>
            </div>
            <div>
              <dt>Zona horaria</dt>
              <dd>{tested.server.timezone ?? "No informada"}</dd>
            </div>
            <div>
              <dt>Capacidades</dt>
              <dd>{Object.values(tested.capabilities).filter(Boolean).length} disponibles</dd>
            </div>
          </dl>
          {tested.warnings.map((warning) => (
            <p className="alert-warning" key={warning}>
              {warning}
            </p>
          ))}
          {create.isError ? <p className="alert-error">{create.error.message}</p> : null}
          <div className="mt-6 flex justify-between">
            <button
              className="btn-secondary"
              onClick={() => {
                setStep(2);
              }}
            >
              Atrás
            </button>
            <button
              className="btn-primary"
              disabled={create.isPending}
              onClick={() => {
                create.mutate(form.getValues());
              }}
            >
              {create.isPending ? "Guardando…" : "Guardar conexión"}
            </button>
          </div>
        </PageSection>
      ) : null}
      <Link className="text-sm text-slate-500 hover:text-slate-800" to={returnTo}>
        Cancelar
      </Link>
      <UnsavedChangesDialog
        onLeave={unsaved.leave}
        onStay={unsaved.stay}
        open={unsaved.isBlocked}
      />
    </PageContainer>
  );
}
