import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";

import type { BackendStatusValue } from "../services/health";

interface BackendStatusProps {
  status: BackendStatusValue;
}

const statusContent = {
  checking: {
    label: "Comprobando backend",
    Icon: LoaderCircle,
    className: "text-amber-700 bg-amber-50 border-amber-200",
    iconClassName: "animate-spin",
  },
  available: {
    label: "Backend disponible",
    Icon: CircleCheck,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
    iconClassName: "",
  },
  unavailable: {
    label: "Backend no disponible",
    Icon: CircleX,
    className: "text-red-700 bg-red-50 border-red-200",
    iconClassName: "",
  },
} as const;

export function BackendStatus({ status }: BackendStatusProps) {
  const { label, Icon, className, iconClassName } = statusContent[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${className}`}
      role="status"
    >
      <Icon aria-hidden="true" className={`size-4 ${iconClassName}`} />
      {label}
    </div>
  );
}
