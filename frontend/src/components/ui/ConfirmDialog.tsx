import { Button } from "./Button";
import { Modal } from "./Modal";
interface ConfirmDialogProps {
  confirmLabel?: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  supportingText?: string;
  title: string;
}
export function ConfirmDialog({
  confirmLabel = "Eliminar",
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  supportingText = "Esta acción puede ser irreversible. Confirma que deseas continuar.",
  title,
}: ConfirmDialogProps) {
  return (
    <Modal
      description={description}
      footer={
        <>
          <Button disabled={loading} onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
          <Button loading={loading} onClick={onConfirm} variant="danger">
            {confirmLabel}
          </Button>
        </>
      }
      loading={loading}
      onClose={onCancel}
      open={open}
      size="sm"
      title={title}
    >
      <p className="text-body-small text-foreground-secondary">{supportingText}</p>
    </Modal>
  );
}
