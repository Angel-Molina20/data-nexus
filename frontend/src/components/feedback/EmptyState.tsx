import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "../ui/StatusBadge";

interface EmptyStateProps {
  badge?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}

export function EmptyState({ badge, description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="rounded-2xl bg-blue-50 p-4 text-blue-600">
        <Icon aria-hidden="true" className="size-8" />
      </span>
      {badge ? (
        <div className="mt-5">
          <StatusBadge variant="info">{badge}</StatusBadge>
        </div>
      ) : null}
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
