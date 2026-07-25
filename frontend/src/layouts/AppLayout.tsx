import type { ReactNode } from "react";
import { Database } from "lucide-react";
import { Link } from "react-router";

import { APP_NAME } from "../app/constants";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <Database aria-hidden="true" className="size-5 text-blue-400" />
            {APP_NAME}
          </Link>
          <nav aria-label="Navegación principal">
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              to="/connections"
            >
              Conexiones
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">{children}</main>
    </div>
  );
}
