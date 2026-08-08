import type { ReactNode } from "react";

interface PageSectionProps {
  children: ReactNode;
  description?: string;
  title?: string;
}

export function PageSection({ children, description, title }: PageSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      {title ? (
        <div className="mb-5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
