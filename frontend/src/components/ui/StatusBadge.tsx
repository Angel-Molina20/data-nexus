import type { ReactNode } from "react";

import type { StatusVariant } from "../../types/status";

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusVariant;
}

const variantClasses: Record<StatusVariant, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function StatusBadge({ children, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
