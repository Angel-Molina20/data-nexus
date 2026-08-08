import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listConnections } from "../features/connections/api/connectionsApi";
import { ConnectionsPage } from "./ConnectionsPage";

vi.mock("../features/connections/api/connectionsApi", () => ({
  listConnections: vi.fn(),
  deleteConnection: vi.fn(),
  retestConnection: vi.fn(),
}));

const mockedList = vi.mocked(listConnections);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConnectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders its loading state", () => {
    mockedList.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText("Cargando conexiones…")).toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    renderPage();
    expect(await screen.findByText("Aún no hay conexiones registradas")).toBeInTheDocument();
  });

  it("renders a safe connection summary", async () => {
    mockedList.mockResolvedValue({
      items: [
        {
          id: "96b2de36-1557-4e9e-981c-e78b64831f0f",
          name: "MySQL comercial",
          engine: "mysql",
          provider: "mysql",
          host: "db.internal",
          port: 3306,
          database_name: "analytics",
          status: "connected",
          raw_version: "8.0.42",
          last_tested_at: null,
          created_at: "2026-07-25T00:00:00Z",
          updated_at: "2026-07-25T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    renderPage();
    expect(await screen.findByText("MySQL comercial")).toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  it("renders a controlled error", async () => {
    mockedList.mockRejectedValue(new Error("network"));
    renderPage();
    expect(await screen.findByText("No fue posible cargar las conexiones.")).toBeInTheDocument();
  });
});
