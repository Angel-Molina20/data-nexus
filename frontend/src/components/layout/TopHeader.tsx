import { LogOut, Menu, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../../features/auth/context";
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
  const auth = useAuth();
  const navigate = useNavigate();
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
        <div className="flex items-center gap-3">
          <BackendStatus compact status={backendStatus} />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{auth.user?.full_name}</p>
            <p className="text-xs text-slate-500">{auth.user?.roles.join(", ")}</p>
          </div>
          <Link aria-label="Cambiar contraseña" className="rounded-lg border p-2 text-slate-600" to="/account/change-password"><UserRound className="size-4" /></Link>
          <button aria-label="Cerrar sesión" className="rounded-lg border p-2 text-slate-600" onClick={() => { void auth.logout().then(() => navigate("/login")); }}><LogOut className="size-4" /></button>
        </div>
      </div>
    </header>
  );
}
