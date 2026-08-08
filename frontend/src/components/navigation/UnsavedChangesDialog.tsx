import { ConfirmDialog } from "../ui/ConfirmDialog";

interface UnsavedChangesDialogProps {
  onLeave: () => void;
  onStay: () => void;
  open: boolean;
}

export function UnsavedChangesDialog({ onLeave, onStay, open }: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      confirmLabel="Salir sin guardar"
      description="Si sales ahora, perderás los cambios realizados."
      onCancel={onStay}
      onConfirm={onLeave}
      open={open}
      supportingText="Puedes seguir editando para revisar o guardar tu trabajo."
      title="Tienes cambios sin guardar"
    />
  );
}
