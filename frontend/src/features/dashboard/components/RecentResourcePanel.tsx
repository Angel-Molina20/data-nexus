import { ArrowRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/FeedbackStates";

interface RecentResourcePanelProps {
  children?: ReactNode;
  emptyAction?: ReactNode;
  emptyDescription: string;
  loading?: boolean;
  title: string;
  viewAllTo?: string;
}

export function RecentResourcePanel({
  children,
  emptyAction,
  emptyDescription,
  loading = false,
  title,
  viewAllTo,
}: RecentResourcePanelProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <h2 className="text-heading-3">{title}</h2>
        {viewAllTo ? (
          <Link
            className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            to={viewAllTo}
          >
            Ver todas <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div
            aria-label={`Cargando ${title.toLowerCase()}`}
            className="space-y-5 p-5"
            role="status"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex items-center gap-3" key={index}>
                <Skeleton className="size-9 shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : children ? (
          <div className="divide-y divide-border">{children}</div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center px-5 py-8 text-center">
            <span className="rounded-lg bg-surface-muted p-3 text-muted">
              <Inbox aria-hidden="true" className="size-5" />
            </span>
            <p className="text-body-small mt-3 text-muted">{emptyDescription}</p>
            {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
