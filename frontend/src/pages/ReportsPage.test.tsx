import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listReports } from "../features/reports/api/reportsApi";
import { ReportsPage } from "./ReportsPage";

vi.mock("../features/reports/api/reportsApi", () => ({
  listReports: vi.fn(),
  archiveReport: vi.fn(),
  deleteReport: vi.fn(),
  publishReport: vi.fn(),
}));

const mockedList = vi.mocked(listReports);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading and empty states", async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    renderPage();
    expect(screen.getByText("Cargando reportes…")).toBeInTheDocument();
    expect(await screen.findByText("Aún no hay reportes.")).toBeInTheDocument();
  });

  it("renders report state, pinned revision and actions", async () => {
    mockedList.mockResolvedValue({
      items: [
        {
          id: "report-1",
          name: "Estudiantes activos",
          description: "Listado",
          query_id: "12345678-query",
          query_revision: 4,
          connection_id: "connection-1",
          status: "draft",
          title: "Estudiantes",
          subtitle: null,
          configuration: {
            version: 1,
            layout: {
              orientation: "portrait",
              page_size: "A4",
              show_generated_at: true,
              show_page_numbers: true,
            },
            header: { title: "Estudiantes", subtitle: null, description: null },
            columns: [],
            footer: { text: "", show_row_count: true },
            locale: "es-EC",
            timezone: "America/Guayaquil",
            parameters: {},
          },
          configuration_version: 1,
          created_by: "user-1",
          published_at: null,
          archived_at: null,
          created_at: "2026-08-07T00:00:00Z",
          updated_at: "2026-08-07T00:00:00Z",
          compatible: true,
          warnings: [],
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    renderPage();
    expect(await screen.findByText("Estudiantes activos")).toBeInTheDocument();
    expect(screen.getByText(/revisión 4/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled();
  });
});
