import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { App } from "../../App";
import { useAuth } from "./context";
import { BackButton } from "../../components/navigation/BackButton";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">Comprobando sesión…</div>
    );
  if (!auth.user) return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  if (auth.user.must_change_password && location.pathname !== "/account/change-password")
    return <Navigate replace to="/account/change-password" />;
  return <App />;
}

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const auth = useAuth();
  if (!auth.hasPermission(permission))
    return (
      <div className="state-message">
        <h1 className="text-2xl font-bold">403</h1>
        <p>No tienes permiso para ver esta página.</p>
        <div className="mt-4 flex justify-center">
          <BackButton fallback="/" label="Volver" />
        </div>
      </div>
    );
  return children;
}
