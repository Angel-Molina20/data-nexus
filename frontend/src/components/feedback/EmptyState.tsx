import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { StatusBadge } from "../ui/StatusBadge";
import { EmptyStateBase } from "../ui/FeedbackStates";

interface EmptyStateProps {
  badge?: string;
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}

export function EmptyState({ action, badge, description, icon: Icon, title }: EmptyStateProps) {
  const footer = badge || action ? <div className="flex flex-wrap items-center justify-center gap-2">{badge ? <StatusBadge variant="info">{badge}</StatusBadge> : null}{action}</div> : undefined;
  return <EmptyStateBase action={footer} description={description} icon={Icon} title={title} />;
}
