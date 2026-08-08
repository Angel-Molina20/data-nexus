import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";

import type { BackendStatusValue } from "../../shared/api/health";

interface BackendStatusProps {
  compact?: boolean;
  status: BackendStatusValue;
}

const statusContent = {
  checking: {
    label: "Comprobando backend",
    shortLabel: "Comprobando",
    Icon: LoaderCircle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName: "animate-spin",
  },
  available: {
    label: "Backend disponible",
    shortLabel: "Disponible",
    Icon: CircleCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "",
  },
  unavailable: {
    label: "Backend no disponible",
    shortLabel: "No disponible",
    Icon: CircleX,
    className: "border-red-200 bg-red-50 text-red-700",
    iconClassName: "",
  },
} as const;

export function BackendStatus({ compact = false, status }: BackendStatusProps) {
  const { label, shortLabel, Icon, className, iconClassName } = statusContent[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${className}`}
      role="status"
      title={compact ? label : undefined}
    >
      <Icon aria-hidden="true" className={`size-3.5 ${iconClassName}`} />
      <span className={compact ? "hidden sm:inline" : undefined}>
        {compact ? shortLabel : label}
      </span>
    </div>
  );
}
