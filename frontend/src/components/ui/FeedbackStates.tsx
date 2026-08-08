import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./utils";

export function Spinner({
  label = "Cargando",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span aria-label={label} className="inline-flex" role="status">
      <LoaderCircle
        className={cx(
          "animate-spin",
          size === "sm" ? "size-4" : size === "lg" ? "size-8" : "size-5",
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("block animate-pulse rounded-md bg-surface-muted", className)}
    />
  );
}
export function LoadingState({ label = "Cargando contenido…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted"
      role="status"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({
  details,
  message,
  onBack,
  onRetry,
  title = "No fue posible cargar el contenido",
}: {
  details?: ReactNode;
  message: string;
  onBack?: () => void;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
      <span className="rounded-full bg-red-50 p-3 text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="text-heading-3 mt-4">{title}</h2>
      <p className="text-body-small mt-2 max-w-md text-muted">{message}</p>
      {details ? (
        <details className="mt-3 max-w-xl text-left text-xs text-muted">
          <summary>Detalles técnicos</summary>
          {details}
        </details>
      ) : null}
      <div className="mt-5 flex gap-2">
        {onBack ? (
          <Button onClick={onBack} variant="secondary">
            Volver
          </Button>
        ) : null}
        {onRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
      </div>
    </div>
  );
}
export function EmptyStateBase({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="rounded-lg bg-blue-50 p-4 text-primary">
        <Icon aria-hidden="true" className="size-8" />
      </span>
      <h2 className="text-heading-3 mt-4">{title}</h2>
      <p className="text-body-small mt-2 max-w-md text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
