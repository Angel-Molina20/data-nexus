import { Database, Plus } from "lucide-react";

import { EmptyState } from "../components/feedback/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";

export function ConnectionsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Conexiones"
        description="Administra las fuentes de datos disponibles para consultas y reportes."
        actions={
          <button
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
            disabled
            title="Disponible en la siguiente fase"
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nueva conexión
          </button>
        }
      />
      <PageSection>
        <EmptyState
          icon={Database}
          title="Aún no hay conexiones registradas"
          description="La gestión de conexiones MySQL se implementará en la siguiente fase. Este espacio mostrará las fuentes configuradas."
          badge="Fase 2"
        />
      </PageSection>
    </PageContainer>
  );
}
