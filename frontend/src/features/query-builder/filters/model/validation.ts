import type { QueryExpression, QueryIssue } from "../../../queries/types";
import type { FilterFieldOption } from "./types";

/* eslint-disable @typescript-eslint/restrict-template-expressions -- field references are backend-validated scalar identifiers inside the recursive JSON contract. */

export function filterIssues(
  where: QueryExpression | null | undefined,
  having: QueryExpression | null | undefined,
  fields: FilterFieldOption[],
): QueryIssue[] {
  const available = new Set(
    fields
      .filter((field) => field.available)
      .map((field) => `${field.expression.source_id}:${field.expression.field_id}`),
  );
  const issues: QueryIssue[] = [];
  const inspect = (node: QueryExpression, area: "where" | "having", path: number[]) => {
    if (node.node_type === "logical_group") {
      const conditions = Array.isArray(node.conditions)
        ? (node.conditions as QueryExpression[])
        : [];
      if (!conditions.length) issues.push(issue(area, path, "El grupo no contiene condiciones."));
      conditions.forEach((condition, index) => {
        inspect(condition, area, [...path, index]);
      });
    }
    for (const expression of expressionChildren(node)) {
      if (
        expression.node_type === "field" &&
        !available.has(`${String(expression.source_id)}:${String(expression.field_id)}`)
      )
        issues.push(
          issue(area, path, "El campo ya no está disponible en el contexto de la consulta."),
        );
    }
    if (node.node_type === "in" && Array.isArray(node.values) && node.values.length === 0)
      issues.push(issue(area, path, "Añade al menos un valor a la lista."));
  };
  if (where) inspect(where, "where", []);
  if (having) inspect(having, "having", []);
  return issues;
}

function expressionChildren(node: QueryExpression): QueryExpression[] {
  const result: QueryExpression[] = [];
  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value))
      result.push(
        ...value.filter((item): item is QueryExpression =>
          Boolean(item && typeof item === "object" && "node_type" in item),
        ),
      );
    else if ("node_type" in value) result.push(value as QueryExpression);
  }
  return result;
}

function issue(area: "where" | "having", path: number[], message: string): QueryIssue {
  return {
    code: "QUERY_FILTER_INVALID",
    message,
    severity: "error",
    path: `query.${area}${path.map((index) => `.conditions[${String(index)}]`).join("")}`,
    node_id: `${area}:${path.join(".")}`,
  };
}
