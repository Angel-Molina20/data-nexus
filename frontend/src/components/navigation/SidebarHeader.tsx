import { Network, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link } from "react-router";

import { APP_NAME, APP_TAGLINE } from "../../app/constants";

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onToggle?: () => void;
}

export function SidebarHeader({ isCollapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div className="flex h-16 items-center border-b border-white/10 px-3">
      <Link
        aria-label="Ir al dashboard de DataNexus"
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-white ${
          isCollapsed ? "justify-center" : ""
        }`}
        to="/"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-950/40">
          <Network aria-hidden="true" className="size-5" />
        </span>
        {!isCollapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{APP_NAME}</span>
            <span className="block truncate text-[10px] text-slate-400">{APP_TAGLINE}</span>
          </span>
        ) : null}
      </Link>
      {onToggle ? (
        <button
          aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          className="ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          onClick={onToggle}
          type="button"
        >
          {isCollapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
