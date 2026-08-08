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
  { label: "Conexiones", path: "/connections", icon: Database, permission: "connections.read" },
  { label: "Explorador de esquemas", path: "/schema", icon: TableProperties, permission: "schemas.read" },
  { label: "Consultas", path: "/queries", icon: SearchCode, permission: "queries.read" },
  { label: "Reportes", path: "/reports", icon: FileBarChart, permission: "reports.read" },
  { label: "Catálogo semántico", path: "/semantic-catalog", icon: BookOpenText, permission: "semantic_catalog.read" },
  { label: "Programaciones", path: "/schedules", icon: CalendarClock },
  { label: "Usuarios", path: "/users", icon: Users, permission: "users.read" },
  { label: "Configuración", path: "/settings", icon: Settings },
];

export function getPageTitle(pathname: string): string {
  if (pathname === "/reports/new") return "Nuevo reporte";
  if (/^\/reports\/[^/]+\/edit$/.test(pathname)) return "Editar reporte";
  if (/^\/reports\/[^/]+$/.test(pathname)) return "Detalle de reporte";
  if (pathname === "/queries/new") return "Nueva consulta";
  if (/^\/queries\/[^/]+\/edit-json$/.test(pathname)) return "Editor JSON";
  if (/^\/queries\/[^/]+$/.test(pathname)) return "Detalle de consulta";
  if (pathname === "/account/change-password") return "Cambiar contraseña";
  if (pathname === "/settings/roles") return "Roles y permisos";
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
