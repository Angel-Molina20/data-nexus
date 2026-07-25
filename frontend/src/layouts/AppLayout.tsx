import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import { getPageTitle } from "../app/navigation";
import { TopHeader } from "../components/layout/TopHeader";
import { MobileNavigation } from "../components/navigation/MobileNavigation";
import { Sidebar } from "../components/navigation/Sidebar";
import type { BackendStatusValue } from "../services/health";

interface AppLayoutProps {
  backendStatus: BackendStatusValue;
  children: ReactNode;
}

export function AppLayout({ backendStatus, children }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50 text-slate-950">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => {
          setIsSidebarCollapsed((current) => !current);
        }}
      />
      <MobileNavigation
        isOpen={isMobileMenuOpen}
        onClose={() => {
          setIsMobileMenuOpen(false);
        }}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopHeader
          backendStatus={backendStatus}
          pageTitle={pageTitle}
          onOpenMobileMenu={() => {
            setIsMobileMenuOpen(true);
          }}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
