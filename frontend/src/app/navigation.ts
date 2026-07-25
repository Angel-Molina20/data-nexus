import {
  BookOpenText,
  CalendarClock,
  Database,
  FileBarChart,
  LayoutDashboard,
  SearchCode,
  Settings,
  TableProperties,
  Users,
} from "lucide-react";

import type { NavigationItem } from "../types/navigation";

export const navigationItems: readonly NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Conexiones", path: "/connections", icon: Database },
  { label: "Explorador de esquemas", path: "/schema", icon: TableProperties },
  { label: "Consultas", path: "/queries", icon: SearchCode },
  { label: "Reportes", path: "/reports", icon: FileBarChart },
  { label: "Catálogo semántico", path: "/semantic-catalog", icon: BookOpenText },
  { label: "Programaciones", path: "/schedules", icon: CalendarClock },
  { label: "Usuarios", path: "/users", icon: Users },
  { label: "Configuración", path: "/settings", icon: Settings },
];

export function getPageTitle(pathname: string): string {
  return navigationItems.find((item) => item.path === pathname)?.label ?? "Página no encontrada";
}
