import {
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  FileBarChart,
  Link2,
  Plus,
  SearchCode,
  Server,
} from "lucide-react";
import { Link, useOutletContext } from "react-router";

import type { AppOutletContext } from "../App";
import { APP_TAGLINE } from "../app/constants";
import { BackendStatus } from "../components/feedback/BackendStatus";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { PageSection } from "../components/layout/PageSection";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  dashboardActivities,
  dashboardQuickActions,
  dashboardStats,
  type DashboardIconName,
} from "../data/dashboard";

const dashboardIcons = {
  connections: Database,
  reports: FileBarChart,
  queries: SearchCode,
  sources: Server,
  add: Plus,
  chart: BarChart3,
  link: Link2,
} satisfies Record<DashboardIconName, typeof Database>;

export function HomePage() {
  const { backendStatus } = useOutletContext<AppOutletContext>();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Centro de trabajo"
        title="Bienvenido a DataNexus"
        description={`${APP_TAGLINE}. Centraliza la exploración, las consultas y los reportes de tus fuentes de datos.`}
        actions={<BackendStatus status={backendStatus} />}
      />

      <section
        aria-label="Resumen de DataNexus"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {dashboardStats.map((stat) => {
          const Icon = dashboardIcons[stat.icon];

          return (
            <article
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              key={stat.label}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {stat.value}
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{stat.detail}</p>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)]">
        <PageSection
          title="Actividad reciente"
          description="Vista simulada de la actividad que concentrará el dashboard."
        >
          <div className="divide-y divide-slate-100">
            {dashboardActivities.map((activity) => (
              <div className="flex items-start gap-3 py-4 first:pt-1 last:pb-1" key={activity.id}>
                <span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                  <Clock3 aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    <StatusBadge variant={activity.variant}>{activity.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{activity.description}</p>
                  <p className="mt-2 text-xs text-slate-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection
          title="Acciones rápidas"
          description="Accesos a los módulos preparados para las siguientes fases."
        >
          <div className="space-y-3">
            {dashboardQuickActions.map((action) => {
              const Icon = dashboardIcons[action.icon];

              return (
                <Link
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  key={action.label}
                  to={action.to}
                >
                  <span className="rounded-md bg-blue-600 p-2 text-white">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {action.label}
                    </span>
                    <span className="block text-xs text-slate-500">{action.description}</span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                  />
                </Link>
              );
            })}
          </div>
        </PageSection>
      </div>
    </PageContainer>
  );
}
