import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportEditorForm } from "../features/reports/components/ReportEditorForm";
import { useReportEditorPage } from "../features/reports/hooks/useReportEditorPage";
import { routes } from "../app/router/routes";
import { Link } from "react-router";
import { UnsavedChangesDialog } from "../components/navigation/UnsavedChangesDialog";

export function ReportEditorPage() {
  const editor = useReportEditorPage();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Editor de reportes"
        title={editor.isEditing ? "Editar reporte" : "Nuevo reporte"}
        description="La definición queda fijada a una revisión de consulta y una instantánea del AST."
        backAction={{
          fallback: editor.isEditing
            ? routes.reports.detail(editor.report.data?.id ?? "")
            : routes.reports.list(),
          label: "Volver",
        }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Reportes", to: routes.reports.list() },
          ...(editor.isEditing && editor.report.data
            ? [{ label: editor.report.data.name, to: routes.reports.detail(editor.report.data.id) }]
            : []),
          { label: editor.isEditing ? "Editar" : "Nuevo reporte" },
        ]}
      />
      {editor.report.isError ? (
        <p className="alert-error">No fue posible cargar el reporte.</p>
      ) : null}
      <ReportEditorForm
        draft={editor.draft}
        isEditing={editor.isEditing}
        isSaving={editor.save.isPending}
        isValid={editor.isValid}
        queries={editor.queries.data?.items ?? []}
        selectedQuery={editor.selectedQuery}
        onSave={() => {
          editor.save.mutate();
        }}
        onUpdate={editor.updateDraft}
        onUpdateParameter={editor.updateParameter}
      />
      <div className="flex justify-end">
        <Link className="btn-secondary" to={editor.returnTo}>
          Cancelar
        </Link>
      </div>
      {editor.save.isError ? (
        <p className="alert-error">No fue posible guardar el reporte.</p>
      ) : null}
      <UnsavedChangesDialog
        onLeave={editor.unsaved.leave}
        onStay={editor.unsaved.stay}
        open={editor.unsaved.isBlocked}
      />
    </PageContainer>
  );
}
