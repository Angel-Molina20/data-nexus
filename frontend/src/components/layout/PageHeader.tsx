import type { ReactNode } from "react";

import { BackButton, type BackButtonProps } from "../navigation/BackButton";
import { Breadcrumbs, type BreadcrumbItem } from "../navigation/Breadcrumbs";

interface PageHeaderProps {
  actions?: ReactNode;
  backAction?: BackButtonProps;
  breadcrumb?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  description: string;
  eyebrow?: string;
  status?: ReactNode;
  title: string;
}

export function PageHeader({
  actions,
  backAction,
  breadcrumb,
  breadcrumbs,
  description,
  eyebrow,
  status,
  title,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        {backAction || breadcrumbs || breadcrumb ? (
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
            {backAction ? <BackButton {...backAction} /> : null}
            {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : breadcrumb}
          </div>
        ) : null}
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-1">{title}</h1>
          {status}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
