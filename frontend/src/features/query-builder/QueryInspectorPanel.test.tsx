import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { QueryDocument } from "../queries/types";
import type { SchemaEntity } from "../schema/types";
import { QueryInspectorPanel } from "./QueryInspectorPanel";

const document: QueryDocument = {
  schema_version: "1.0",
  connection_id: "connection",
  query: {
    scope_id: "root",
    query_type: "select",
    source: { source_id: "students", entity_id: "student_entity", alias: "students" },
    joins: [],
    select: [
      {
        select_id: "student_name",
        item_type: "field",
        expression: { node_type: "field", source_id: "students", field_id: "name" },
        label: "Nombre",
      },
      {
        select_id: "student_email",
        item_type: "field",
        expression: { node_type: "field", source_id: "students", field_id: "email" },
        label: "Correo",
        alias: "email_address",
      },
      {
        select_id: "student_count",
        item_type: "aggregate",
        expression: { node_type: "aggregate", aggregate: "count_all", argument: null },
        label: "Total",
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
};

it("groups selected fields by source and keeps field settings collapsed", () => {
  const onChange = vi.fn();
  render(
    <QueryInspectorPanel
      document={document}
      entities={{}}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="fields"
    />,
  );

  expect(screen.getByRole("button", { name: /students.*2 campos/i })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(screen.getByText("Entidad principal")).toBeVisible();
  expect(screen.getByRole("button", { name: /Relaciones.*0/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(
    screen.getByRole("button", { name: /Expresiones y agregaciones.*1 campo/i }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Alias")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /students.*2 campos/i }));
  expect(screen.getByText("Nombre")).toBeVisible();
  expect(screen.getByText("as email_address")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Nombre$/ }));
  expect(screen.getByLabelText("Alias")).toBeVisible();
});

it("offers deletion for orders, parameters and UNION branches", () => {
  const editable = structuredClone(document);
  editable.query.order_by = [
    {
      expression: { node_type: "field", source_id: "students", field_id: "name" },
      direction: "ascending",
      nulls: "engine_default",
    },
  ];
  editable.parameters = [
    {
      parameter_id: "search",
      name: "search",
      label: "Búsqueda",
      data_type: "string",
      required: false,
      nullable: true,
      validation: {},
      sensitive: false,
      display_order: 0,
    },
  ];
  editable.query.unions = [
    {
      union_id: "union_1",
      operation: "union",
      query: { ...structuredClone(editable.query), unions: [] },
    },
  ];
  const onChange = vi.fn();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const props = {
    document: editable,
    entities: {},
    onChange,
    onTab: vi.fn(),
    readOnly: false,
    selectedJoinId: null,
    selectedSourceId: "students",
  };
  const view = render(<QueryInspectorPanel {...props} tab="order" />);
  fireEvent.click(screen.getByRole("button", { name: "Eliminar orden 1" }));
  expect((onChange.mock.calls[0]?.[0] as QueryDocument).query.order_by).toEqual([]);
  view.rerender(<QueryInspectorPanel {...props} tab="parameters" />);
  fireEvent.click(screen.getByRole("button", { name: "Eliminar parámetro Búsqueda" }));
  expect((onChange.mock.calls[1]?.[0] as QueryDocument).parameters).toEqual([]);
  view.rerender(<QueryInspectorPanel {...props} tab="unions" />);
  fireEvent.click(screen.getByRole("button", { name: "Eliminar rama UNION 1" }));
  expect((onChange.mock.calls[2]?.[0] as QueryDocument).query.unions).toEqual([]);
});

it("adds every selected groupable expression to GROUP BY in one change", () => {
  const onChange = vi.fn();
  const view = render(
    <QueryInspectorPanel
      document={document}
      entities={{}}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="grouping"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Agregar todas las expresiones (2)" }));
  const next = onChange.mock.calls[0]?.[0] as QueryDocument;
  expect(next.query.group_by).toHaveLength(2);
  expect(next.query.group_by.map((item) => item.expression.field_id)).toEqual(["name", "email"]);
  view.rerender(
    <QueryInspectorPanel
      document={next}
      entities={{}}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="grouping"
    />,
  );
  expect(screen.getByText("students.Nombre")).toBeVisible();
  expect(screen.getByText("students.Correo")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Eliminar students.Nombre de GROUP BY" }),
  ).toBeVisible();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Quitar todos los campos" }));
  expect((onChange.mock.calls[1]?.[0] as QueryDocument).query.group_by).toEqual([]);
});

it("shows COUNT as active and allows removing the grouping requirement", () => {
  const onChange = vi.fn();
  render(
    <QueryInspectorPanel
      document={document}
      entities={{}}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="grouping"
    />,
  );
  expect(screen.getByText("COUNT(*)")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar agregación COUNT(*)" }));
  const next = onChange.mock.calls[0]?.[0] as QueryDocument;
  expect(next.query.select.some((item) => item.expression.node_type === "aggregate")).toBe(false);
});

it("creates COUNT DISTINCT from any available field, even when it is not selected", () => {
  const onChange = vi.fn();
  const studentEntity = {
    id: "student_entity",
    fields: [
      {
        id: "age",
        display_name: "Edad",
        is_active: true,
      },
    ],
  } as SchemaEntity;
  render(
    <QueryInspectorPanel
      document={document}
      entities={{ student_entity: studentEntity }}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="grouping"
    />,
  );
  fireEvent.change(screen.getByLabelText("Argumento de COUNT"), {
    target: { value: "field:students:age" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Contar valores distintos" }));
  fireEvent.click(screen.getByRole("button", { name: "Agregar COUNT DISTINCT" }));
  const next = onChange.mock.calls[0]?.[0] as QueryDocument;
  const aggregate = next.query.select.at(-1)?.expression;
  expect(aggregate).toMatchObject({
    node_type: "aggregate",
    aggregate: "count",
    distinct: true,
    argument: { node_type: "field", source_id: "students", field_id: "age" },
  });
});

it("reuses an existing AST subquery as the COUNT argument", () => {
  const withSubquery = structuredClone(document);
  withSubquery.query.select.push({
    select_id: "subquery_valid_students",
    item_type: "subquery",
    expression: {
      node_type: "subquery",
      query_id: "valid_students",
      query: { ...structuredClone(document.query), scope_id: "child", unions: [] },
      correlation: [],
    },
    label: "Estudiantes válidos",
  });
  const onChange = vi.fn();
  render(
    <QueryInspectorPanel
      document={withSubquery}
      entities={{}}
      onChange={onChange}
      onTab={vi.fn()}
      readOnly={false}
      selectedJoinId={null}
      selectedSourceId="students"
      tab="grouping"
    />,
  );
  fireEvent.change(screen.getByLabelText("Argumento de COUNT"), {
    target: { value: "subquery:subquery_valid_students" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Agregar COUNT" }));
  const next = onChange.mock.calls[0]?.[0] as QueryDocument;
  expect(next.query.select.at(-1)?.expression.argument).toMatchObject({
    node_type: "subquery",
    query_id: "valid_students",
  });
});
