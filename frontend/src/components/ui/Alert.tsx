import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cx } from "./utils";

export type AlertVariant = "info" | "success" | "warning" | "error";
interface AlertProps {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: string;
  onClose?: () => void;
  title?: string;
  variant?: AlertVariant;
}
const styles: Record<AlertVariant, string> = {
  info: "border-sky-200 bg-sky-50 text-info",
  success: "border-emerald-200 bg-emerald-50 text-success",
  warning: "border-amber-200 bg-amber-50 text-warning",
  error: "border-red-200 bg-red-50 text-danger",
};
const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert };
export function Alert({
  action,
  children,
  className,
  description,
  onClose,
  title,
  variant = "info",
}: AlertProps) {
  const Icon = icons[variant];
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-md border p-4 text-sm",
        styles[variant],
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {description ? <p className={cx(title && "mt-1", "opacity-90")}>{description}</p> : null}
        {children}
      </div>
      {action}
      {onClose ? (
        <IconButton label="Cerrar aviso" onClick={onClose} size="sm">
          <X className="size-4" />
        </IconButton>
      ) : null}
    </div>
  );
}
