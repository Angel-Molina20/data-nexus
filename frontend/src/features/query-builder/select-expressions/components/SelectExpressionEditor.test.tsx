import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as testingRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";

import type { QueryDocument } from "../../../queries/types";
import type { SchemaEntity } from "../../../schema/types";
import { SelectExpressionEditor } from "./SelectExpressionEditor";

vi.mock("../hooks/useSavedSubqueryOptions", () => ({
  useSavedSubqueryOptions: () => ({
    loading: false,
    options: [
      {
        id: "saved_query",
        name: "Consulta guardada",
        document: { query: { select: [{ select_id: "saved_id" }] } },
      },
    ],
    selected: {
      document: {
        query: {
          scope_id: "saved_scope",
          query_type: "select",
          source: { source_id: "saved", entity_id: "student_entity", alias: "saved" },
          joins: [],
          select: [
            {
              select_id: "saved_id",
              item_type: "field",
              expression: { node_type: "field", source_id: "saved", field_id: "name" },
              label: "Nombre interno",
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

vi.mock("../../../schema/api/schemaApi", () => ({
  getSchemaEntity: () =>
    Promise.resolve({
      id: "student_entity",
      display_name: "Estudiante",
      physical_name: "students",
      fields: [
        {
          id: "name",
          display_name: "Nombre",
          physical_name: "name",
          normalized_data_type: "string",
          is_active: true,
        },
      ],
    }),
}));

const document: QueryDocument = {
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "students", entity_id: "student_entity", alias: "students" },
    joins: [],
    select: [],
    group_by: [],
    order_by: [],
    distinct: false,
    unions: [],
  },
  parameters: [],
  metadata: {},
  options: {},
};
const entity = {
  id: "student_entity",
  fields: [{ id: "name", display_name: "Nombre", is_active: true }],
} as SchemaEntity;

const render = (element: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return testingRender(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
};

it("builds CONCAT from a field and literal without generating SQL", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Argumento 1"), {
    target: { value: "field:students:name" },
  });
  fireEvent.change(screen.getByLabelText("Origen del argumento 2"), {
    target: { value: "literal" },
  });
  fireEvent.change(screen.getByLabelText("Valor del argumento 2"), {
    target: { value: " - activo" },
  });
  fireEvent.change(screen.getByLabelText("Alias"), { target: { value: "nombre_estado" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    item_type: "expression",
    alias: "nombre_estado",
    expression: {
      node_type: "function",
      function: "concat",
      arguments: [
        { node_type: "field", source_id: "students", field_id: "name" },
        { node_type: "literal", value: " - activo" },
      ],
    },
  });
});

it("builds GROUP_CONCAT as an aggregate expression", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Función"), { target: { value: "group_concat" } });
  fireEvent.change(screen.getByLabelText("Argumento 1"), {
    target: { value: "field:students:name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    item_type: "aggregate",
    expression: {
      node_type: "aggregate",
      aggregate: "group_concat",
      argument: { node_type: "field", source_id: "students", field_id: "name" },
      distinct: false,
    },
  });
});

it("models visual IF as a portable CASE expression", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Tipo de expresión"), {
    target: { value: "case" },
  });
  fireEvent.change(screen.getByLabelText("Campo"), {
    target: { value: "field:students:name" },
  });
  fireEvent.change(screen.getByLabelText("Valor esperado"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Entonces"), { target: { value: "Sí" } });
  fireEvent.change(screen.getByLabelText("Si no"), { target: { value: "No" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    expression: {
      node_type: "case",
      branches: [
        {
          when: { node_type: "comparison", operator: "equals" },
          then: { node_type: "literal", value: "Sí" },
        },
      ],
      else_expression: { node_type: "literal", value: "No" },
    },
  });
});

it("creates the first subquery from a compatible saved query", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Tipo de expresión"), {
    target: { value: "subquery" },
  });
  fireEvent.change(screen.getByLabelText("Subconsulta"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    item_type: "subquery",
    expression: {
      node_type: "subquery",
      query: { scope_id: "saved_scope" },
      correlation: [],
    },
  });
});

it("adds an additional WHERE to a SELECT subquery", async () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Tipo de expresión"), {
    target: { value: "subquery" },
  });
  fireEvent.change(screen.getByLabelText("Subconsulta"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Añadir condición interna" }));
  fireEvent.change(screen.getByLabelText("Campo", { exact: true }), {
    target: { value: "inner:saved:name" },
  });
  fireEvent.change(screen.getByLabelText("Valor 1"), { target: { value: "Ada" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar condición" }));
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));

  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    expression: {
      node_type: "subquery",
      query: {
        where: {
          node_type: "comparison",
          operator: "equals",
          left: { node_type: "field", source_id: "saved", field_id: "name" },
          right: { node_type: "literal", value: "Ada" },
        },
      },
    },
  });
});

it("adds a correlated WHERE using an outer field reference", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Tipo de expresión"), {
    target: { value: "subquery" },
  });
  fireEvent.change(screen.getByLabelText("Subconsulta"), {
    target: { value: "saved:saved_query" },
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Correlacionar con la consulta principal" }),
  );
  fireEvent.change(screen.getByLabelText("Campo principal"), {
    target: { value: "field:students:name" },
  });
  fireEvent.change(screen.getByLabelText("Campo de subconsulta"), {
    target: { value: "inner:saved:name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a SELECT" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    expression: {
      node_type: "subquery",
      correlation: [
        { node_type: "outer_field", scope_id: "root", source_id: "students", field_id: "name" },
      ],
      query: {
        where: {
          node_type: "comparison",
          operator: "equals",
          left: { node_type: "field", source_id: "saved", field_id: "name" },
          right: {
            node_type: "outer_field",
            scope_id: "root",
            source_id: "students",
            field_id: "name",
          },
        },
      },
    },
  });
});

it("edits an existing function while preserving its SELECT id", () => {
  const onCommit = vi.fn();
  render(
    <SelectExpressionEditor
      document={document}
      entities={{ student_entity: entity }}
      initialItem={{
        select_id: "existing_expression",
        item_type: "expression",
        expression: {
          node_type: "function",
          function: "concat",
          arguments: [
            { node_type: "field", source_id: "students", field_id: "name" },
            { node_type: "literal", value_type: "string", value: " viejo" },
          ],
          options: {},
        },
        label: "Nombre compuesto",
      }}
      onClose={vi.fn()}
      onCommit={onCommit}
      open
    />,
  );
  fireEvent.change(screen.getByLabelText("Valor del argumento 2"), {
    target: { value: " actualizado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar expresión" }));
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
    select_id: "existing_expression",
    expression: {
      function: "concat",
      arguments: [{ node_type: "field" }, { value: " actualizado" }],
    },
  });
});
