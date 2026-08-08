import { Menu, Power, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../../features/auth/context";
import type { BackendStatusValue } from "../../services/health";
import { BackendStatus } from "../feedback/BackendStatus";
import { IconButton } from "../ui/IconButton";

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
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="shrink-0 border border-border lg:hidden"
            label="Abrir menú principal"
            onClick={onOpenMobileMenu}
          >
            <Menu aria-hidden="true" className="size-5" />
          </IconButton>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">DataNexus</p>
            <p className="truncate text-base font-semibold text-foreground">{pageTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BackendStatus compact status={backendStatus} />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{auth.user?.full_name}</p>
            <p className="text-xs text-muted">{auth.user?.roles.join(", ")}</p>
          </div>
          <Link aria-label="Cambiar contraseña" className="rounded-lg border p-2 text-slate-600" to="/account/change-password"><UserRound className="size-4" /></Link>
          <IconButton className="header-logout-button border border-border bg-surface shadow-sm" label="Cerrar sesión" onClick={() => { void auth.logout().then(() => { void navigate("/login", { replace: true }); }); }}><Power aria-hidden="true" /></IconButton>
        </div>
      </div>
    </header>
  );
}
