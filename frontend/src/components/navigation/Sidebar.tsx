import { StatusBadge } from "../ui/StatusBadge";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavigation } from "./SidebarNavigation";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#071a34] text-white transition-[width] duration-200 lg:flex ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <SidebarHeader isCollapsed={isCollapsed} onToggle={onToggle} />
      <SidebarNavigation isCollapsed={isCollapsed} />
      <div className="border-t border-white/10 p-4">
        {isCollapsed ? (
          <span
            aria-label="Entorno de desarrollo"
            className="mx-auto block size-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10"
            title="Entorno de desarrollo"
          />
        ) : (
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs font-medium text-slate-300">Entorno local</p>
            <div className="mt-2">
              <StatusBadge variant="success">Desarrollo</StatusBadge>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
