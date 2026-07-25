import { Menu } from "lucide-react";

import type { BackendStatusValue } from "../../services/health";
import { BackendStatus } from "../feedback/BackendStatus";

interface TopHeaderProps {
  backendStatus: BackendStatusValue;
  onOpenMobileMenu: () => void;
  pageTitle: string;
}

export function TopHeader({
  backendStatus,
  onOpenMobileMenu,
  pageTitle,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Abrir menú principal"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            onClick={onOpenMobileMenu}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">DataNexus</p>
            <p className="truncate text-base font-semibold text-slate-900">{pageTitle}</p>
          </div>
        </div>
        <BackendStatus compact status={backendStatus} />
      </div>
    </header>
  );
}
