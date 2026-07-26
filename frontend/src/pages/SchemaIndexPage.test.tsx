import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { listConnections } from "../services/connections";
import { SchemaIndexPage } from "./SchemaIndexPage";

vi.mock("../services/connections", () => ({ listConnections: vi.fn() }));
const mockedList = vi.mocked(listConnections);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SchemaIndexPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SchemaIndexPage", () => {
  it("shows the empty state when no connections exist", async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    renderPage();
    expect(await screen.findByText("No hay conexiones disponibles")).toBeInTheDocument();
  });

  it("offers registered connections without exposing secrets", async () => {
    mockedList.mockResolvedValue({
      items: [{
        id: "96b2de36-1557-4e9e-981c-e78b64831f0f",
        name: "Académica",
        engine: "mysql",
        provider: "mysql",
        host: "mysql8",
        port: 3306,
        database_name: "academic",
        status: "connected",
        raw_version: "8.0.42",
        last_tested_at: null,
        created_at: "2026-07-25T00:00:00Z",
        updated_at: "2026-07-25T00:00:00Z",
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    renderPage();
    expect(await screen.findByText("Académica")).toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });
});
