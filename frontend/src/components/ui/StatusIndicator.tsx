import { Circle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeVariant } from "./Badge";
import { cx } from "./utils";
interface StatusIndicatorProps {
  children: ReactNode;
  running?: boolean;
  variant?: BadgeVariant;
}
const colors: Record<BadgeVariant, string> = {
  neutral: "text-muted",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
export function StatusIndicator({
  children,
  running = false,
  variant = "neutral",
}: StatusIndicatorProps) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", colors[variant])}>
      {running ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Circle aria-hidden="true" className="size-2 fill-current" />
      )}
      <span>{children}</span>
    </span>
  );
}
