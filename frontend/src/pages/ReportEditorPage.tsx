import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportEditorForm } from "../features/reports/components/ReportEditorForm";
import { useReportEditorPage } from "../features/reports/hooks/useReportEditorPage";

export function ReportEditorPage() {
  const editor = useReportEditorPage();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Editor de reportes"
        title={editor.isEditing ? "Editar reporte" : "Nuevo reporte"}
        description="La definición queda fijada a una revisión de consulta y una instantánea del AST."
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
      {editor.save.isError ? (
        <p className="alert-error">No fue posible guardar el reporte.</p>
      ) : null}
    </PageContainer>
  );
}
