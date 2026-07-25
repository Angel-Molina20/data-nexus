import type { StatusVariant } from "../types/status";

export type DashboardIconName =
  | "connections"
  | "reports"
  | "queries"
  | "sources"
  | "add"
  | "chart"
  | "link";

interface DashboardStat {
  detail: string;
  icon: DashboardIconName;
  label: string;
  value: string;
}

interface DashboardQuickAction {
  description: string;
  icon: DashboardIconName;
  label: string;
  to: string;
}

interface DashboardActivity {
  description: string;
  id: number;
  status: string;
  time: string;
  title: string;
  variant: StatusVariant;
}

export const dashboardStats: readonly DashboardStat[] = [
  {
    label: "Conexiones",
    value: "0",
    detail: "Fuentes registradas en esta etapa",
    icon: "connections",
  },
  {
    label: "Reportes",
    value: "0",
    detail: "Reportes guardados",
    icon: "reports",
  },
  {
    label: "Consultas recientes",
    value: "0",
    detail: "Ejecuciones durante los últimos 7 días",
    icon: "queries",
  },
  {
    label: "Fuentes disponibles",
    value: "2",
    detail: "MySQL 5.6 y MySQL 8 en el alcance inicial",
    icon: "sources",
  },
];

export const dashboardQuickActions: readonly DashboardQuickAction[] = [
  {
    label: "Nueva conexión",
    description: "Preparado para la siguiente fase",
    icon: "add",
    to: "/connections",
  },
  {
    label: "Crear consulta",
    description: "Acceder al módulo temporal",
    icon: "link",
    to: "/queries",
  },
  {
    label: "Ver reportes",
    description: "Explorar el espacio de reportes",
    icon: "chart",
    to: "/reports",
  },
];

export const dashboardActivities: readonly DashboardActivity[] = [
  {
    id: 1,
    title: "Infraestructura inicial disponible",
    description: "Los servicios base de DataNexus están configurados.",
    status: "Completado",
    variant: "success",
    time: "Fase 0",
  },
  {
    id: 2,
    title: "Shell visual habilitado",
    description: "La navegación principal y las páginas temporales están disponibles.",
    status: "En desarrollo",
    variant: "info",
    time: "Fase 1",
  },
  {
    id: 3,
    title: "Gestión de conexiones",
    description: "Será el siguiente módulo funcional de la plataforma.",
    status: "Pendiente",
    variant: "warning",
    time: "Siguiente fase",
  },
];
