import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../features/auth/context";
import { getDashboardSummary } from "../features/dashboard/api/dashboardApi";
import type { DashboardSummary } from "../features/dashboard/types";
import { HomePage } from "./HomePage";

vi.mock("../features/dashboard/api/dashboardApi", () => ({ getDashboardSummary: vi.fn() }));

const currentUser = {
  id: "user-id",
  email: "analyst@example.test",
  full_name: "Ana Molina",
  status: "active",
  roles: ["analyst"],
  permissions: [
    "connections.read",
    "connections.create",
    "queries.read",
    "queries.create",
    "queries.execute",
    "reports.read",
    "reports.create",
  ],
  must_change_password: false,
};

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    generated_at: "2026-08-08T17:00:00Z",
    execution_period_started_at: "2026-08-07T17:00:00Z",
    connections: {
      available: true,
      total: 6,
      connected: 5,
      items: [
        {
          id: "connection-id",
          name: "Producción",
          engine: "mysql",
          provider: "mysql",
          raw_version: "8.4.10",
          status: "connected",
          updated_at: "2026-08-08T16:00:00Z",
        },
      ],
    },
    queries: {
      available: true,
      total: 18,
      items: [
        {
          id: "query-id",
          name: "Usuarios activos",
          connection_id: "connection-id",
          status: "draft",
          validation_status: "valid",
          updated_at: "2026-08-08T16:30:00Z",
        },
      ],
    },
    executions: {
      available: true,
      last_24_hours: 42,
      items: [
        {
          id: "execution-id",
          query_id: "query-id",
          query_name: "Usuarios activos",
          status: "completed",
          duration_ms: 245,
          row_count: 1245,
          started_at: "2026-08-08T16:45:00Z",
        },
      ],
    },
    reports: {
      available: true,
      total: 8,
      published: 3,
      items: [
        {
          id: "report-id",
          name: "Reporte mensual",
          query_id: "query-id",
          query_name: "Usuarios activos",
          status: "published",
          updated_at: "2026-08-08T15:00:00Z",
        },
      ],
    },
    ...overrides,
  };
}

function renderDashboard(permissions = currentUser.permissions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{
          user: { ...currentUser, permissions },
          loading: false,
          logout: vi.fn(),
          hasPermission: (permission) => permissions.includes(permission),
        }}
      >
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<Outlet context={{ backendStatus: "available" }} />}>
              <Route index element={<HomePage />} />
              <Route path="queries/:id/builder" element={<h1>Constructor abierto</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.mocked(getDashboardSummary).mockReset();
  });

  it("renders real metrics and opens a recent query", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary());
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Bienvenido, Ana" })).toBeInTheDocument();
    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1.245 filas/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Usuarios activos.*Válida/ }));
    expect(screen.getByRole("heading", { name: "Constructor abierto" })).toBeInTheDocument();
  });

  it("shows useful onboarding when there are no connections", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(
      summary({
        connections: { available: true, total: 0, connected: 0, items: [] },
        queries: { available: true, total: 0, items: [] },
        executions: { available: true, last_24_hours: 0, items: [] },
        reports: { available: true, total: 0, published: 0, items: [] },
      }),
    );
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Prepara tu espacio de datos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Crear primera conexión/ })).toBeInTheDocument();
    expect(screen.getByText("Aún no tienes consultas guardadas.")).toBeInTheDocument();
  });

  it("hides creation actions and unavailable sections without permission", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(
      summary({
        connections: { available: true, total: 1, connected: 1, items: [] },
        queries: { available: false, total: null, items: [] },
        executions: { available: false, last_24_hours: null, items: [] },
        reports: { available: false, total: null, published: null, items: [] },
      }),
    );
    renderDashboard(["connections.read"]);

    expect(await screen.findByText("1 disponibles según la última prueba")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nueva consulta" })).not.toBeInTheDocument();
    expect(screen.queryByText("Consultas recientes")).not.toBeInTheDocument();
  });

  it("keeps navigation usable when the summary fails", async () => {
    vi.mocked(getDashboardSummary).mockRejectedValue(new TypeError("Failed to fetch"));
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("El dashboard no está disponible");
    expect(screen.getByRole("link", { name: "Nueva consulta" })).toBeInTheDocument();
  });
});
