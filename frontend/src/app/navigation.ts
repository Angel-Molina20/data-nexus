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
  if (pathname === "/connections/new") return "Nueva conexión";
  if (/^\/connections\/[^/]+\/edit$/.test(pathname)) return "Editar conexión";
  if (/^\/connections\/[^/]+\/schema\/synchronizations$/.test(pathname)) {
    return "Historial de sincronizaciones";
  }
  if (/^\/connections\/[^/]+\/schema/.test(pathname)) return "Explorador de esquemas";
  if (/^\/connections\/[^/]+\/relationships\/candidates$/.test(pathname)) return "Sugerencias de relaciones";
  if (/^\/connections\/[^/]+\/relationships\/polymorphic\/new$/.test(pathname)) return "Nueva relación polimórfica";
  if (/^\/connections\/[^/]+\/relationships\/new$/.test(pathname)) return "Nueva relación manual";
  if (/^\/connections\/[^/]+\/relationships/.test(pathname)) return "Catálogo de relaciones";
  if (/^\/connections\/[^/]+\/semantic-catalog/.test(pathname)) return "Catálogo semántico";
  if (/^\/connections\/[^/]+$/.test(pathname)) return "Detalle de conexión";
  return navigationItems.find((item) => item.path === pathname)?.label ?? "Página no encontrada";
}
