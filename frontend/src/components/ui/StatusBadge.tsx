import type { ReactNode } from "react";

import type { StatusVariant } from "../../types/status";
import { Badge } from "./Badge";

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusVariant;
}

export function StatusBadge({ children, variant = "neutral" }: StatusBadgeProps) {
  return <Badge variant={variant}>{children}</Badge>;
}
