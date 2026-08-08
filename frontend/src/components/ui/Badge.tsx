import type { HTMLAttributes } from "react";
import { cx } from "./utils";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";
const variants: Record<BadgeVariant, string> = { neutral: "border-border bg-surface-muted text-foreground-secondary", info: "border-sky-200 bg-sky-50 text-info", success: "border-emerald-200 bg-emerald-50 text-success", warning: "border-amber-200 bg-amber-50 text-warning", danger: "border-red-200 bg-red-50 text-danger" };
export function Badge({ className, variant = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) { return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", variants[variant], className)} {...props} />; }
