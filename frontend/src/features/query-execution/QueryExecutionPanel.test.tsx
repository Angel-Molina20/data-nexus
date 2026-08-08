import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executeQuery } from "./api/executionsApi";
import type { QueryDocument } from "../queries/types";
import { QueryExecutionPanel } from "./QueryExecutionPanel";

vi.mock("./api/executionsApi", () => ({ executeQuery: vi.fn(), cancelExecution: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const document: QueryDocument = {
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "source", entity_id: "entity", alias: "source" },
    joins: [],
    select: [
      {
        select_id: "name",
        item_type: "literal",
        expression: { node_type: "literal", value_type: "string", value: "Ada" },
      },
    ],
    group_by: [],
    order_by: [],
    distinct: false,
    unions: [],
  },
  parameters: [
    {
      parameter_id: "active",
      name: "active",
      label: "Activo",
      data_type: "boolean",
      required: true,
      nullable: false,
      validation: {},
      sensitive: false,
      display_order: 0,
    },
  ],
  metadata: {},
  options: {},
};

const response = {
  execution: {
    id: "execution",
    connection_id: "connection",
    query_id: "query",
    query_revision: 2,
    status: "completed" as const,
    started_at: "2026-08-01T00:00:00Z",
    finished_at: "2026-08-01T00:00:01Z",
    duration_ms: 25,
    row_count: 1,
    returned_row_count: 1,
    truncated: true,
    page: 1,
    page_size: 50,
    total_rows: null,
    total_pages: null,
    error_code: null,
    error_message: null,
  },
  columns: [
    {
      key: "payload",
      label: "payload",
      data_type: "json",
      nullable: false,
      source: null,
      format: null,
    },
    {
      key: "optional",
      label: "optional",
      data_type: "string",
      nullable: true,
      source: null,
      format: null,
    },
  ],
  rows: [{ payload: { name: "Ada" }, optional: null }],
  warnings: [],
  metadata: { database_engine: "mysql", database_version: "8.0", compiled_sql: null },
};

describe("QueryExecutionPanel", () => {
  it("sends the AST and parameters and renders dynamic results", async () => {
    vi.mocked(executeQuery).mockResolvedValue(response);
    const user = userEvent.setup();
    render(
      <QueryExecutionPanel
        document={document}
        queryId="query"
        revision={2}
        canExecute
        blocked={false}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Activo/ }));
    await user.click(screen.getByRole("button", { name: "Ejecutar consulta" }));
    expect(executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        connection_id: "connection",
        query_id: "query",
        query_revision: 2,
        ast: document,
        parameters: { active: true },
      }),
      expect.any(AbortSignal),
    );
    expect(await screen.findByRole("columnheader", { name: /payload/i })).toBeInTheDocument();
    expect(screen.getByText("NULL")).toBeInTheDocument();
    expect(screen.getByText("Resultado truncado")).toBeInTheDocument();
    const inspector = screen.getAllByTitle("Inspeccionar valor")[0];
    if (!inspector) throw new Error("Expected a result cell inspector");
    await user.click(inspector);
    expect(screen.getByRole("dialog")).toHaveTextContent('"name": "Ada"');
  });

  it("keeps the query available after an execution error", async () => {
    vi.mocked(executeQuery).mockRejectedValue(new Error("offline"));
    render(
      <QueryExecutionPanel
        document={{ ...document, parameters: [] }}
        queryId="query"
        revision={2}
        canExecute
        blocked={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar consulta" }));
    expect(await screen.findByText("No fue posible ejecutar la consulta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ejecutar consulta" })).toBeEnabled();
  });

  it("disables execution when validation blocks the AST", () => {
    render(
      <QueryExecutionPanel
        document={{ ...document, parameters: [] }}
        queryId="query"
        revision={2}
        canExecute
        blocked
      />,
    );
    expect(screen.getByRole("button", { name: "Ejecutar consulta" })).toBeDisabled();
  });
});
