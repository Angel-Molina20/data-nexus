import { useEffect, useState, type ReactNode } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";

import { getPageTitle } from "../navigation";
import { TopHeader } from "../../components/layout/TopHeader";
import { MobileNavigation } from "../../components/navigation/MobileNavigation";
import { Sidebar } from "../../components/navigation/Sidebar";
import type { BackendStatusValue } from "../../shared/api/health";

interface AppLayoutProps {
  backendStatus: BackendStatusValue;
  children: ReactNode;
}

export function AppLayout({ backendStatus, children }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigationType = useNavigationType();
  const pageTitle = getPageTitle(location.pathname);
  const isQueryBuilder = /^\/queries\/[^/]+\/builder\/?$/.test(location.pathname);

  useEffect(() => {
    if (isQueryBuilder) setIsSidebarCollapsed(true);
  }, [isQueryBuilder]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.title = `${pageTitle} | DataNexus`;
  }, [pageTitle]);

  useEffect(() => {
    const key = location.key;
    const position = scrollPositions.get(key);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: navigationType === NavigationType.Pop ? (position ?? 0) : 0 });
    });
    return () => {
      scrollPositions.set(key, window.scrollY);
    };
  }, [location.key, navigationType]);

  return (
    <div
      className={`flex min-w-0 bg-background text-foreground ${isQueryBuilder ? "h-dvh overflow-hidden" : "min-h-screen"}`}
    >
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

      <div
        className={`flex min-w-0 flex-1 flex-col ${isQueryBuilder ? "min-h-0" : "min-h-screen"}`}
      >
        <TopHeader
          backendStatus={backendStatus}
          pageTitle={pageTitle}
          onOpenMobileMenu={() => {
            setIsMobileMenuOpen(true);
          }}
        />
        <main
          className={`min-w-0 flex-1 ${isQueryBuilder ? "min-h-0 overflow-hidden" : "overflow-x-hidden"}`}
        >
          <div
            className={
              isQueryBuilder
                ? "flex h-full min-h-0 w-full flex-col"
                : "w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

const scrollPositions = new Map<string, number>();
