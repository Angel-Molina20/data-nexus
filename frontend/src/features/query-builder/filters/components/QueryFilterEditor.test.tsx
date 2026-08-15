import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { QueryDocument } from "../../../queries/types";
import type { SchemaEntity } from "../../../schema/types";
import { QueryFilterEditor } from "./QueryFilterEditor";

/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock call tuples are intentionally inspected at the integration boundary. */

vi.mock("../../../relationships/api/relationshipsApi", () => ({
  listSemanticEntities: () => Promise.resolve({ items: [], total: 0 }),
}));

vi.mock("../../../schema/api/schemaApi", () => ({
  getSchemaEntity: () =>
    Promise.resolve({
      id: "entity",
      display_name: "Persona",
      physical_name: "people",
      fields: [
        {
          id: "status-id",
          display_name: "Estado",
          physical_name: "status",
          normalized_data_type: "string",
          is_active: true,
        },
      ],
    }),
}));

vi.mock("../../select-expressions/hooks/useSavedSubqueryOptions", () => ({
  useSavedSubqueryOptions: () => ({
    loading: false,
    options: [
      {
        id: "saved_query",
        name: "Estados permitidos",
        connection_id: "connection",
        document: {
          query: {
            scope_id: "saved_scope",
            query_type: "select",
            source: { source_id: "saved_people", entity_id: "entity", alias: "persona" },
            joins: [],
            select: [
              {
                select_id: "saved_status",
                item_type: "field",
                expression: {
                  node_type: "field",
                  source_id: "saved_people",
                  field_id: "status-id",
                },
                label: "Estado interno",
              },
            ],
            group_by: [],
            order_by: [],
            distinct: false,
            unions: [],
          },
        },
      },
    ],
    selected: {
      document: {
        query: {
          scope_id: "saved_scope",
          query_type: "select",
          source: { source_id: "saved_people", entity_id: "entity", alias: "persona" },
          joins: [],
          select: [
            {
              select_id: "saved_status",
              item_type: "field",
              expression: {
                node_type: "field",
                source_id: "saved_people",
                field_id: "status-id",
              },
              label: "Estado interno",
            },
          ],
          group_by: [],
          order_by: [],
          distinct: false,
          unions: [],
        },
      },
    },
  }),
}));

const document: QueryDocument = {
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "people", entity_id: "entity", alias: "persona" },
    joins: [],
    select: [],
    where: null,
    group_by: [],
    having: null,
    order_by: [],
    distinct: false,
    unions: [],
  },
  parameters: [],
  metadata: {},
  options: {},
};
const entity = {
  id: "entity",
  display_name: "Persona",
  physical_name: "people",
  fields: [
    {
      id: "status-id",
      display_name: "Estado",
      physical_name: "status",
      normalized_data_type: "string",
      is_active: true,
    },
  ],
} as SchemaEntity;

const renderEditor = (onChange = vi.fn(), readOnly = false, value = document) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <QueryFilterEditor
        canUseSensitive
        document={value}
        entities={{ entity }}
        onChange={onChange}
        readOnly={readOnly}
      />
    </QueryClientProvider>,
  );
  return onChange;
};

it("keeps an incomplete filter as UI draft and commits one valid AST predicate", () => {
  const onChange = renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Añadir condición" }));
  expect(screen.getByText("Completa el campo, operador y los valores requeridos.")).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Campo"), {
    target: { value: "field:people:status-id" },
  });
  fireEvent.change(screen.getByLabelText("Valor 1"), { target: { value: "activo" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar condición" }));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0]?.[0].query.where).toMatchObject({
    node_type: "comparison",
    operator: "equals",
    right: { node_type: "literal", value: "activo" },
  });
});

it("separates HAVING and blocks mutation controls in read-only mode", () => {
  renderEditor(vi.fn(), true);
  fireEvent.click(screen.getByRole("tab", { name: "HAVING" }));
  expect(screen.getByText(/No hay condiciones HAVING/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Añadir condición" })).not.toBeInTheDocument();
});

it("creates a correlated IN subquery as one AST condition", () => {
  const onChange = renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Añadir subconsulta" }));
  fireEvent.change(screen.getByLabelText("Campo comparado"), {
    target: { value: "field:people:status-id" },
  });
  fireEvent.change(screen.getByLabelText("Consulta guardada para filtro"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Correlacionar con la consulta principal" }),
  );
  fireEvent.change(screen.getByLabelText("Campo principal de correlación"), {
    target: { value: "field:people:status-id" },
  });
  fireEvent.change(screen.getByLabelText("Campo interno de correlación"), {
    target: { value: "inner:saved_people:status-id" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar subconsulta" }));

  expect(onChange.mock.calls[0]?.[0].query.where).toMatchObject({
    node_type: "in",
    values: null,
    expression: { node_type: "field", source_id: "people", field_id: "status-id" },
    subquery: {
      node_type: "subquery",
      correlation: [{ node_type: "outer_field", scope_id: "root" }],
      query: { where: { node_type: "comparison", operator: "equals" } },
    },
  });
});

it("creates EXISTS without requiring a comparison field", () => {
  const onChange = renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Añadir subconsulta" }));
  fireEvent.change(screen.getByLabelText("Operador de subconsulta"), {
    target: { value: "not_exists" },
  });
  fireEvent.change(screen.getByLabelText("Consulta guardada para filtro"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar subconsulta" }));

  expect(onChange.mock.calls[0]?.[0].query.where).toMatchObject({
    node_type: "exists",
    negated: true,
    query: { node_type: "subquery", query: { scope_id: "saved_scope" } },
  });
});

it("adds an extra WHERE condition inside a saved subquery", async () => {
  const onChange = renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Añadir subconsulta" }));
  fireEvent.change(screen.getByLabelText("Campo comparado", { exact: true }), {
    target: { value: "field:people:status-id" },
  });
  fireEvent.change(screen.getByLabelText("Consulta guardada para filtro"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Añadir condición interna" }));
  fireEvent.change(screen.getByLabelText("Campo", { exact: true }), {
    target: { value: "inner:saved_people:status-id" },
  });
  fireEvent.change(screen.getByLabelText("Valor 1"), { target: { value: "activo" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar condición" }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar subconsulta" }));

  expect(onChange.mock.calls[0]?.[0].query.where).toMatchObject({
    node_type: "in",
    subquery: {
      query: {
        where: {
          node_type: "comparison",
          operator: "equals",
          left: { source_id: "saved_people", field_id: "status-id" },
          right: { node_type: "literal", value: "activo" },
        },
      },
    },
  });
});

it("edits an existing subquery condition without losing its embedded AST", () => {
  const configured = structuredClone(document);
  configured.query.where = {
    node_type: "exists",
    negated: false,
    query: {
      node_type: "subquery",
      query_id: "existing_query",
      correlation: [
        {
          node_type: "outer_field",
          scope_id: "root",
          source_id: "people",
          field_id: "status-id",
        },
      ],
      query: {
        scope_id: "saved_scope",
        query_type: "select",
        source: { source_id: "saved_people", entity_id: "entity", alias: "persona" },
        joins: [],
        select: [
          {
            select_id: "saved_status",
            item_type: "field",
            expression: {
              node_type: "field",
              source_id: "saved_people",
              field_id: "status-id",
            },
          },
        ],
        where: {
          node_type: "comparison",
          operator: "equals",
          left: { node_type: "field", source_id: "saved_people", field_id: "status-id" },
          right: {
            node_type: "outer_field",
            scope_id: "root",
            source_id: "people",
            field_id: "status-id",
          },
        },
        group_by: [],
        order_by: [],
        distinct: false,
        unions: [],
      },
    },
  };
  const onChange = renderEditor(vi.fn(), false, configured);
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText("Operador de subconsulta"), {
    target: { value: "not_exists" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar subconsulta" }));

  expect(onChange.mock.calls[0]?.[0].query.where).toMatchObject({
    node_type: "exists",
    negated: true,
    query: {
      query_id: "existing_query",
      correlation: [{ node_type: "outer_field", scope_id: "root" }],
      query: { where: { right: { node_type: "outer_field", scope_id: "root" } } },
    },
  });
});
