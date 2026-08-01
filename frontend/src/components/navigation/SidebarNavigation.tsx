import { navigationItems } from "../../app/navigation";
import { SidebarItem } from "./SidebarItem";
import { useAuth } from "../../features/auth/context";

interface SidebarNavigationProps {
  isCollapsed: boolean;
}

export function SidebarNavigation({ isCollapsed }: SidebarNavigationProps) {
  const { hasPermission } = useAuth();
  return (
    <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {navigationItems.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => (
          <li key={item.path}>
            <SidebarItem isCollapsed={isCollapsed} item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
