import { navigationItems } from "../../app/navigation";
import { SidebarItem } from "./SidebarItem";

interface SidebarNavigationProps {
  isCollapsed: boolean;
}

export function SidebarNavigation({ isCollapsed }: SidebarNavigationProps) {
  return (
    <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {navigationItems.map((item) => (
          <li key={item.path}>
            <SidebarItem isCollapsed={isCollapsed} item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
