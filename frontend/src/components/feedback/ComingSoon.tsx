import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "../ui/StatusBadge";

interface ComingSoonProps {
  description: string;
  detail: string;
  icon: LucideIcon;
  phase: string;
  title: string;
}

export function ComingSoon({
  description,
  detail,
  icon: Icon,
  phase,
  title,
}: ComingSoonProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
      <span className="rounded-2xl bg-blue-50 p-4 text-blue-600">
        <Icon aria-hidden="true" className="size-9" />
      </span>
      <div className="mt-5">
        <StatusBadge variant="info">{phase}</StatusBadge>
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-3 max-w-xl text-base text-slate-600">{description}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}
