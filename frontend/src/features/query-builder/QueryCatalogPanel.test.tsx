import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueryDocument } from "../queries/types";
import { QueryCatalogPanel } from "./QueryCatalogPanel";

const listEntities =
  vi.fn<(connectionId: string, filters?: Record<string, unknown>) => Promise<unknown>>();
const getEntity = vi.fn<(connectionId: string, entityId: string) => Promise<unknown>>();
const listSemantics = vi.fn<(connectionId: string) => Promise<unknown>>();
vi.mock("../schema/api/schemaApi", () => ({
  listSchemaEntities: (connectionId: string, filters?: Record<string, unknown>) =>
    listEntities(connectionId, filters),
  getSchemaEntity: (connectionId: string, entityId: string) => getEntity(connectionId, entityId),
}));
vi.mock("../relationships/api/relationshipsApi", () => ({
  listSemanticEntities: (connectionId: string) => listSemantics(connectionId),
}));

const document = (selected = false): QueryDocument => ({
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "src_students", entity_id: "students", alias: "students" },
    joins: [],
    select: selected
      ? [
          {
            select_id: "selected",
            item_type: "field",
            expression: { node_type: "field", source_id: "src_students", field_id: "name" },
            label: "Nombre",
          },
        ]
      : [],
    group_by: [],
    order_by: [],
    distinct: false,
    unions: [],
  },
  parameters: [],
  metadata: {},
  options: {},
});
const entitySummary = {
  id: "students",
  schema_name: "academic",
  physical_name: "students",
  display_name: "Estudiantes",
  entity_type: "table" as const,
  is_active: true,
  fields_count: 3,
  has_primary_key: true,
  indexes_count: 1,
  relationships_count: 1,
};
const detail = {
  ...entitySummary,
  connection_id: "connection",
  engine: "mysql",
  comment: null,
  estimated_rows: 5,
  storage_engine: "InnoDB",
  collation: null,
  first_seen_at: "2026-01-01",
  last_seen_at: "2026-01-01",
  fields: [
    {
      id: "id",
      physical_name: "id",
      display_name: "ID",
      ordinal_position: 1,
      native_data_type: "bigint",
      normalized_data_type: "integer",
      column_type: "bigint unsigned",
      is_nullable: false,
      default_value: null,
      is_primary_key: true,
      is_unique: true,
      is_auto_increment: true,
      comment: null,
      is_active: true,
    },
    {
      id: "name",
      physical_name: "name",
      display_name: "Nombre",
      ordinal_position: 2,
      native_data_type: "varchar",
      normalized_data_type: "string",
      column_type: "varchar(255)",
      is_nullable: false,
      default_value: null,
      is_primary_key: false,
      is_unique: false,
      is_auto_increment: false,
      comment: null,
      is_active: true,
    },
    {
      id: "secret",
      physical_name: "secret",
      display_name: "Secreto",
      ordinal_position: 3,
      native_data_type: "varchar",
      normalized_data_type: "string",
      column_type: "varchar(50)",
      is_nullable: true,
      default_value: null,
      is_primary_key: false,
      is_unique: false,
      is_auto_increment: false,
      comment: null,
      is_active: true,
    },
  ],
  indexes: [],
  incoming_relationships: [],
  outgoing_relationships: [
    {
      id: "fk-student",
      constraint_name: "fk_student",
      source_entity_id: "students",
      source_entity: "students",
      target_entity_id: "people",
      target_entity: "people",
      update_rule: null,
      delete_rule: null,
      is_active: true,
      fields: [{ source_field: "name", target_field: "id", sequence: 1 }],
    },
  ],
};

function renderCatalog(props: Partial<React.ComponentProps<typeof QueryCatalogPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaults = {
    canUseSensitive: false,
    document: document(),
    onAddRelationship: vi.fn(),
    onEntity: vi.fn(),
    onFields: vi.fn(),
    readOnly: false,
  };
  const merged = { ...defaults, ...props };
  return {
    ...render(
      <QueryClientProvider client={client}>
        <QueryCatalogPanel {...merged} />
      </QueryClientProvider>,
    ),
    props: merged,
  };
}

beforeEach(() => {
  listEntities.mockResolvedValue({ items: [entitySummary], total: 1, page: 1, page_size: 100 });
  getEntity.mockResolvedValue(detail);
  listSemantics.mockResolvedValue({
    items: [
      {
        id: "students",
        physical_name: "students",
        display_name: "Estudiantes",
        singular_name: null,
        plural_name: null,
        description: null,
        business_domain: null,
        tags: [],
        is_visible: true,
        is_active: true,
        sensitive_fields: 1,
        updated_at: null,
        fields: [
          {
            id: "secret",
            physical_name: "secret",
            display_name: "Secreto",
            description: null,
            semantic_type: "text",
            format: null,
            tags: [],
            is_visible: true,
            is_sensitive: true,
            is_active: true,
          },
        ],
      },
    ],
    total: 1,
  });
});

describe("QueryCatalogPanel", () => {
  it("separates tables and views into collapsible catalog sections", async () => {
    listEntities.mockResolvedValue({
      items: [
        entitySummary,
        {
          ...entitySummary,
          id: "active_students",
          physical_name: "active_students",
          display_name: "Estudiantes activos",
          entity_type: "view",
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    renderCatalog();
    expect(await screen.findByRole("button", { name: /Tablas.*1/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const views = screen.getByRole("button", { name: /Vistas.*1/ });
    expect(views).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(views);
    expect(
      screen
        .getAllByRole("button", { name: /Estudiantes activos/ })
        .find((button) => button.hasAttribute("aria-expanded")),
    ).toBeVisible();
  });

  it("expands inline, renders metadata and selects fields without external scrolling", async () => {
    const { props } = renderCatalog();
    fireEvent.click(await screen.findByRole("button", { name: /Estudiantes/ }));
    expect(await screen.findByRole("checkbox", { name: "Seleccionar campo ID" })).toBeVisible();
    expect(screen.getByTitle("Clave primaria")).toHaveTextContent("PK");
    expect(screen.getByTitle("Clave foránea: people.id")).toHaveTextContent("FK");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar campo ID" }));
    expect(props.onFields).toHaveBeenCalledWith("src_students", [{ id: "id", label: "ID" }], true);
    expect(screen.getByTestId("catalog-scroll")).toHaveClass("overflow-y-auto");
  });

  it("searches case-insensitively through the catalog API without changing the AST", async () => {
    const { props } = renderCatalog();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tablas o campos" }), {
      target: { value: "PERSONA_ID" },
    });
    await waitFor(() => {
      expect(listEntities).toHaveBeenLastCalledWith(
        "connection",
        expect.objectContaining({ search: "PERSONA_ID" }),
      );
    });
    expect(props.onFields).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("supports indeterminate/select-all and excludes sensitive fields without permission", async () => {
    const { props } = renderCatalog({ document: document(true) });
    fireEvent.click(await screen.findByRole("button", { name: /Estudiantes/ }));
    const all = await screen.findByRole("checkbox", {
      name: "Seleccionar todos los campos de Estudiantes",
    });
    await waitFor(() => {
      expect((all as HTMLInputElement).indeterminate).toBe(true);
    });
    expect(screen.getByRole("checkbox", { name: "Seleccionar campo Secreto" })).toBeDisabled();
    fireEvent.click(all);
    expect(props.onFields).toHaveBeenCalledWith(
      "src_students",
      [
        { id: "id", label: "ID" },
        { id: "name", label: "Nombre" },
      ],
      true,
    );
  });

  it("keeps semantic controls disabled in read-only mode", async () => {
    renderCatalog({ readOnly: true });
    fireEvent.click(await screen.findByRole("button", { name: /Estudiantes/ }));
    expect(await screen.findByRole("checkbox", { name: "Seleccionar campo ID" })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar todos los campos de Estudiantes" }),
    ).toBeDisabled();
  });
});
