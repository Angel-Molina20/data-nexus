import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import type { SavedQuery } from "../queries/types";
import { QueryBuilderWorkspace } from "./QueryBuilderWorkspace";
import { createBuilderState } from "./state";

const savedQuery: SavedQuery = {
  id: "query",
  name: "Consulta de estudiantes",
  description: null,
  connection_id: "connection",
  owner_user_id: "user",
  document: {
    schema_version: "1.0",
    connection_id: "connection",
    query: {
      scope_id: "root",
      query_type: "select",
      source: { source_id: "students", entity_id: "entity", alias: "students" },
      joins: [],
      select: [
        {
          select_id: "literal",
          item_type: "literal",
          expression: { node_type: "literal", value_type: "integer", value: 1 },
        },
      ],
      group_by: [],
      order_by: [],
      distinct: false,
      unions: [],
    },
    parameters: [],
    metadata: {},
    options: {},
  },
  schema_version: "1.0",
  status: "draft",
  validation_status: "not_validated",
  validation_errors: [],
  validation_warnings: [],
  fingerprint: null,
  complexity: null,
  revision: 1,
  last_validated_at: null,
  created_at: "2026-08-01",
  updated_at: "2026-08-01",
};

const validate = vi.fn();
const dispatch = vi.fn();
vi.mock("./hooks/useQueryBuilderController", () => ({
  useQueryBuilderController: () => ({
    auth: { hasPermission: () => true },
    busyAction: null,
    compile: vi.fn(),
    connection: { data: { name: "Académica", engine: "mysql", raw_version: "8.0" } },
    dispatch,
    duplicate: vi.fn(),
    entities: {},
    isReadOnly: false,
    isRelationshipDialogOpen: false,
    modify: vi.fn(),
    problems: [],
    reload: vi.fn(),
    save: { isError: false },
    saveDocument: vi.fn(),
    savedQuery,
    setRelationshipDialogOpen: vi.fn(),
    state: createBuilderState(savedQuery, false),
    unsaved: { isBlocked: false, leave: vi.fn(), stay: vi.fn() },
    updateLayout: vi.fn(),
    validate,
  }),
}));
vi.mock("./QueryCanvas", () => ({ QueryCanvas: () => <div aria-label="Lienzo de consulta" /> }));
vi.mock("./QueryCatalogPanel", () => ({
  QueryCatalogPanel: () => <aside aria-label="Catálogo de consulta">Catálogo</aside>,
}));
vi.mock("./QueryInspectorPanel", () => ({
  QueryInspectorPanel: () => <aside aria-label="Inspector">Inspector</aside>,
}));
vi.mock("../query-execution/QueryExecutionPanel", () => ({
  QueryExecutionPanel: () => <div>Resultados existentes</div>,
}));

beforeEach(() => {
  localStorage.clear();
  validate.mockClear();
  dispatch.mockClear();
});

it("renders the workspace regions and changes visual layout without dirty actions", () => {
  render(
    <MemoryRouter initialEntries={["/queries/query/builder"]}>
      <QueryBuilderWorkspace savedQuery={savedQuery} />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Catálogo de consulta")).toBeInTheDocument();
  expect(screen.getByLabelText("Lienzo de consulta")).toBeInTheDocument();
  expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
  expect(screen.getByLabelText("Resultados y validación")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ocultar catálogo" }));
  expect(screen.queryByLabelText("Catálogo de consulta")).not.toBeInTheDocument();
  expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "replace" }));
});

it("opens Problems when validation is requested", () => {
  render(
    <MemoryRouter initialEntries={["/queries/query/builder"]}>
      <QueryBuilderWorkspace savedQuery={savedQuery} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Validar" }));
  expect(validate).toHaveBeenCalledOnce();
});
