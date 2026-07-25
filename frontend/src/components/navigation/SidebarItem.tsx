import { NavLink } from "react-router";

import type { NavigationItem } from "../../types/navigation";

interface SidebarItemProps {
  isCollapsed: boolean;
  item: NavigationItem;
}

export function SidebarItem({ isCollapsed, item }: SidebarItemProps) {
  const Icon = item.icon;

  return (
    <NavLink
      className={({ isActive }) =>
        [
          "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          isCollapsed ? "justify-center" : "",
          isActive
            ? "bg-blue-600 text-white shadow-sm shadow-blue-950/30"
            : "text-slate-300 hover:bg-white/10 hover:text-white",
        ].join(" ")
      }
      end={item.path === "/"}
      title={isCollapsed ? item.label : undefined}
      to={item.path}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
    </NavLink>
  );
}
