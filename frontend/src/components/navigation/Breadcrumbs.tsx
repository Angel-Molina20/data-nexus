import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="min-w-0 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li
              className="flex min-w-0 items-center gap-1.5"
              key={`${item.label}-${String(index)}`}
            >
              {index ? <ChevronRight aria-hidden="true" className="size-3 shrink-0" /> : null}
              {item.to && !isCurrent ? (
                <Link className="truncate font-medium hover:text-primary" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined} className="truncate">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
