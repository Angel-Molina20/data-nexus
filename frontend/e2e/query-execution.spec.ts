import { expect, test } from "@playwright/test";

const query = { id: "query", name: "Estudiantes", description: null, connection_id: "connection", owner_user_id: "user", document: { schema_version: "1.0", connection_id: "connection", query: { scope_id: "root", query_type: "select", source: { source_id: "students", entity_id: "entity", alias: "students" }, joins: [], select: [{ select_id: "name", item_type: "field", expression: { node_type: "field", source_id: "students", field_id: "field" }, alias: "student_name" }], group_by: [], order_by: [], distinct: false, unions: [] }, parameters: [{ parameter_id: "search", name: "search", label: "Nombre", data_type: "string", required: true, nullable: false, validation: {}, sensitive: false, display_order: 0 }], metadata: {}, options: {} }, schema_version: "1.0", status: "draft", validation_status: "valid", validation_errors: [], validation_warnings: [], fingerprint: "fingerprint", complexity: null, revision: 3, last_validated_at: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" };

test.beforeEach(async ({ page }) => {
  let execution = 0;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()); const path = url.pathname; const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/auth/me")) return json({ id: "user", email: "analyst@example.test", full_name: "Analista", status: "active", roles: ["analyst"], permissions: ["queries.read", "queries.update", "queries.validate", "queries.compile", "queries.execute"], must_change_password: false });
    if (path.endsWith("/auth/csrf")) return json({ csrf_token: "csrf" });
    if (path.endsWith("/queries/query")) return json(query);
    if (path.endsWith("/connections/connection")) return json({ id: "connection", name: "Academic", engine: "mysql", raw_version: "8.0.42" });
    if (path.endsWith("/schema/entities")) return json({ items: [{ id: "entity", physical_name: "students", display_name: "Estudiantes", entity_type: "table", is_active: true, fields_count: 1, has_primary_key: false, indexes_count: 0, relationships_count: 0 }], total: 1 });
    if (path.endsWith("/semantic/entities")) return json({ items: [], total: 0 });
    if (path.includes("/schema/entities/entity")) return json({ id: "entity", connection_id: "connection", physical_name: "students", display_name: "Estudiantes", entity_type: "table", engine: "mysql", schema_name: "academic", comment: null, estimated_rows: 3, storage_engine: "InnoDB", collation: null, is_active: true, first_seen_at: "2026-08-01", last_seen_at: "2026-08-01", fields: [{ id: "field", physical_name: "name", display_name: "Nombre", ordinal_position: 1, native_data_type: "varchar", normalized_data_type: "string", column_type: "varchar(255)", is_nullable: false, default_value: null, is_primary_key: false, is_unique: false, is_auto_increment: false, comment: null, is_active: true }], indexes: [], incoming_relationships: [], outgoing_relationships: [] });
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    if (path.endsWith("/query-executions") && route.request().method() === "POST") { execution += 1; const payload = route.request().postDataJSON() as { parameters: { search: string }; pagination: { page: number; page_size: number } }; const pageNumber = payload.pagination.page; return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ execution: { id: `execution-${execution}`, connection_id: "connection", query_id: "query", query_revision: 3, status: "completed", started_at: "2026-08-01T00:00:00Z", finished_at: "2026-08-01T00:00:00Z", duration_ms: 15, row_count: 1, returned_row_count: 1, truncated: pageNumber === 1, page: pageNumber, page_size: payload.pagination.page_size, total_rows: null, total_pages: null, error_code: null, error_message: null }, columns: [{ key: "student_name", label: "Nombre", data_type: "string", nullable: false, source: null, format: null }], rows: [{ student_name: `${payload.parameters.search}-${String(pageNumber)}-${String(execution)}` }], warnings: [], metadata: { database_engine: "mysql", database_version: "8.0.42", compiled_sql: null } }) }); }
    return json({});
  });
});

test("executes, paginates, changes a parameter and executes again", async ({ page }) => {
  await page.goto("/queries/query/builder");
  await expect(
    page.getByRole("heading", { name: "Estudiantes", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nombre").fill("Ada");
  await page.getByRole("button", { name: "Ejecutar consulta" }).click();
  await expect(page.getByRole("cell", { name: "Ada-1-1" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("cell", { name: "Ada-2-2" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Grace");
  await page.getByRole("button", { name: "Volver a ejecutar" }).click();
  await expect(page.getByRole("cell", { name: "Grace-1-3" })).toBeVisible();
});

test("shows a controlled timeout and permits retry", async ({ page }) => {
  await page.route("**/api/v1/query-executions", (route) => route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ code: "QUERY_EXECUTION_TIMEOUT", message: "La ejecución excedió el tiempo permitido." }) }));
  await page.goto("/queries/query/builder");
  await page.getByLabel("Nombre").fill("slow");
  await page.getByRole("button", { name: "Ejecutar consulta" }).click();
  await expect(page.getByText("La ejecución excedió el tiempo permitido.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ejecutar consulta" })).toBeEnabled();
});
