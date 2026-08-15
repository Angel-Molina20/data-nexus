import { AlertTriangle, Code2, Filter, Network, Table2 } from "lucide-react";

import type { QueryIssue } from "../../queries/types";

export type QueryWorkspaceView = "visual" | "filters" | "sql" | "results" | "problems";

const items = [
  { id: "visual", label: "Vista visual", icon: Network },
  { id: "filters", label: "Filtros", icon: Filter },
  { id: "sql", label: "SQL", icon: Code2 },
  { id: "results", label: "Resultados", icon: Table2 },
  { id: "problems", label: "Problemas", icon: AlertTriangle },
] as const;

export function QueryWorkspaceNavigation({
  active,
  problems,
  onChange,
}: {
  active: QueryWorkspaceView;
  problems: QueryIssue[];
  onChange: (view: QueryWorkspaceView) => void;
}) {
  return (
    <nav
      aria-label="Vistas del constructor"
      className="flex min-h-11 shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-white px-3"
      role="tablist"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            aria-selected={active === item.id}
            className={`flex min-h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${active === item.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}
            key={item.id}
            onClick={() => {
              onChange(item.id);
            }}
            role="tab"
            type="button"
          >
            <Icon className="size-4" />
            {item.label}
            {item.id === "problems" && problems.length ? (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                {problems.length}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
