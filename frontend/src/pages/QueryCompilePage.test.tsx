import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { compileSavedQuery, getCompilerCapabilities, getQuery } from "../services/queries";
import { QueryCompilePage } from "./QueryCompilePage";

vi.mock("../services/queries", () => ({
  compileSavedQuery: vi.fn(),
  getCompilerCapabilities: vi.fn(),
  getQuery: vi.fn(),
}));

describe("QueryCompilePage", () => {
  it("shows parameterized SQL and confirms it was not executed", async () => {
    vi.mocked(getQuery).mockResolvedValue({
      id: "query-id",
      name: "Estudiantes activos",
      description: null,
      connection_id: "connection-id",
      owner_user_id: "user-id",
      document: { schema_version: "1.0", connection_id: "connection-id", query: {} },
      schema_version: "1.0",
      status: "valid",
      validation_status: "valid",
      validation_errors: [],
      validation_warnings: [],
      fingerprint: "query-fingerprint",
      complexity: { score: 2, level: "low", metrics: {} },
      revision: 2,
      last_validated_at: "2026-08-01T00:00:00Z",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    vi.mocked(getCompilerCapabilities).mockResolvedValue({
      connection_id: "connection-id",
      engine: "mysql",
      provider: "mysql",
      server_version: "8.0.42",
      compiler_version: "1.0.0",
      capabilities: {},
      supported_features: ["select"],
      warnings: [],
    });
    vi.mocked(compileSavedQuery).mockResolvedValue({
      id: "compilation-id",
      success: true,
      engine: "mysql",
      provider: "mysql",
      server_version: "8.0.42",
      dialect: "mysql",
      compiler_version: "1.0.0",
      sql: "SELECT `s`.`name` FROM `academic`.`students` AS `s` WHERE `s`.`status` = :p_1",
      parameters: {
        p_1: {
          source: "parameter",
          data_type: "string",
          sensitive: false,
          parameter_id: "status",
          has_value: false,
        },
      },
      warnings: [],
      errors: [],
      capabilities_used: [],
      referenced_entities: [],
      referenced_fields: [],
      referenced_relationships: [],
      query_fingerprint: "query-fingerprint",
      compilation_fingerprint: "compilation-fingerprint",
      complexity: { score: 2, level: "low", metrics: {} },
      executed: false,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/queries/query-id/compile"]}>
          <Routes>
            <Route path="/queries/:id/compile" element={<QueryCompilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Compilar vista previa" }));
    expect(await screen.findByText(/consulta no fue ejecutada/i)).toBeInTheDocument();
    expect(screen.getByLabelText("SQL parametrizado de solo lectura")).toHaveTextContent(":p_1");
    expect(screen.queryByRole("button", { name: /ejecutar/i })).not.toBeInTheDocument();
  });
});
