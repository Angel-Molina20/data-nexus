import { expect, test } from "@playwright/test";

const query = { id: "query", name: "Estudiantes", description: null, connection_id: "connection", owner_user_id: "user", document: { schema_version: "1.0", connection_id: "connection", query: { scope_id: "root", query_type: "select", source: { source_id: "students", entity_id: "entity", alias: "students" }, joins: [], select: [{ select_id: "name", item_type: "field", expression: { node_type: "field", source_id: "students", field_id: "field" }, alias: "student_name" }], group_by: [], order_by: [], distinct: false, unions: [] }, parameters: [{ parameter_id: "search", name: "search", label: "Nombre", data_type: "string", required: true, nullable: false, validation: {}, sensitive: false, display_order: 0 }], metadata: {}, options: {} }, schema_version: "1.0", status: "draft", validation_status: "valid", validation_errors: [], validation_warnings: [], fingerprint: "fingerprint", complexity: null, revision: 3, last_validated_at: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" };

test.beforeEach(async ({ page }) => {
  let execution = 0;
  let currentQuery = structuredClone(query);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()); const path = url.pathname; const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/auth/me")) return json({ id: "user", email: "analyst@example.test", full_name: "Analista", status: "active", roles: ["analyst"], permissions: ["queries.read", "queries.update", "queries.validate", "queries.compile", "queries.execute"], must_change_password: false });
    if (path.endsWith("/auth/csrf")) return json({ csrf_token: "csrf" });
    if (path.endsWith("/queries/query") && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as { document: typeof query.document };
      currentQuery = { ...currentQuery, document: payload.document, revision: 4 };
      return json(currentQuery);
    }
    if (path.endsWith("/queries/query")) return json(currentQuery);
    if (path.endsWith("/connections/connection")) return json({ id: "connection", name: "Academic", engine: "mysql", raw_version: "8.0.42" });
    if (path.endsWith("/schema/entities")) return json({ items: [{ id: "entity", schema_name: "academic", physical_name: "students", display_name: "Estudiantes", entity_type: "table", is_active: true, fields_count: 2, has_primary_key: true, indexes_count: 0, relationships_count: 0 }], total: 1, page: 1, page_size: 100 });
    if (path.endsWith("/semantic/entities")) return json({ items: [], total: 0 });
    if (path.includes("/schema/entities/entity")) return json({ id: "entity", connection_id: "connection", physical_name: "students", display_name: "Estudiantes", entity_type: "table", engine: "mysql", schema_name: "academic", comment: null, estimated_rows: 3, storage_engine: "InnoDB", collation: null, is_active: true, first_seen_at: "2026-08-01", last_seen_at: "2026-08-01", fields: [{ id: "id", physical_name: "id", display_name: "ID", ordinal_position: 1, native_data_type: "bigint", normalized_data_type: "integer", column_type: "bigint unsigned", is_nullable: false, default_value: null, is_primary_key: true, is_unique: true, is_auto_increment: true, comment: null, is_active: true }, { id: "field", physical_name: "name", display_name: "Nombre", ordinal_position: 2, native_data_type: "varchar", normalized_data_type: "string", column_type: "varchar(255)", is_nullable: false, default_value: null, is_primary_key: false, is_unique: false, is_auto_increment: false, comment: null, is_active: true }], indexes: [], incoming_relationships: [], outgoing_relationships: [] });
    if (path.endsWith("/query-model/validate")) return json({ valid: true, errors: [], warnings: [], normalized_query: query.document, fingerprint: "fingerprint", complexity: { level: "low", score: 1, metrics: {} } });
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    if (path.endsWith("/query-executions") && route.request().method() === "POST") { execution += 1; const payload = route.request().postDataJSON() as { parameters: { search: string }; pagination: { page: number; page_size: number } }; const pageNumber = payload.pagination.page; return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ execution: { id: `execution-${execution}`, connection_id: "connection", query_id: "query", query_revision: 3, status: "completed", started_at: "2026-08-01T00:00:00Z", finished_at: "2026-08-01T00:00:00Z", duration_ms: 15, row_count: 1, returned_row_count: 1, truncated: pageNumber === 1, page: pageNumber, page_size: payload.pagination.page_size, total_rows: null, total_pages: null, error_code: null, error_message: null }, columns: [{ key: "student_name", label: "Nombre", data_type: "string", nullable: false, source: null, format: null }], rows: [{ student_name: `${payload.parameters.search}-${String(pageNumber)}-${String(execution)}` }], warnings: [], metadata: { database_engine: "mysql", database_version: "8.0.42", compiled_sql: null } }) }); }
    return json({});
  });
});

test("searches, expands and persists a field directly from the catalog", async ({ page }) => {
  await page.goto("/queries/query/builder");
  const search = page.getByRole("searchbox", { name: "Buscar tablas o campos" });
  await search.fill("STUDENTS");
  await expect(page.getByRole("checkbox", { name: "Seleccionar campo ID" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Seleccionar campo ID" }).check();
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Estudiantes/ }).click();
  await expect(page.getByRole("checkbox", { name: "Quitar campo ID" })).toBeChecked();
  const catalog = page.getByTestId("catalog-scroll");
  await expect(catalog).toHaveCSS("overflow-y", "auto");
});

test("executes, paginates, changes a parameter and executes again", async ({ page }) => {
  await page.goto("/queries/query/builder");
  await expect(
    page.getByRole("heading", { name: "Estudiantes", exact: true }),
  ).toBeVisible();
  const node = page.locator(".react-flow__node").first();
  const box = await node.boundingBox();
  if (!box) throw new Error("Expected a visible React Flow node");
  await page.mouse.move(box.x + 40, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 55, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Resultados" }).click();
  await page.getByLabel("Nombre").fill("Ada");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Ada-1-1" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("cell", { name: "Ada-2-2" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Grace");
  await page.getByRole("button", { name: "Reejecutar", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Grace-1-3" })).toBeVisible();
});

test("shows a controlled timeout and permits retry", async ({ page }) => {
  await page.route("**/api/v1/query-executions", (route) => route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ code: "QUERY_EXECUTION_TIMEOUT", message: "La ejecución excedió el tiempo permitido." }) }));
  await page.goto("/queries/query/builder");
  await page.getByRole("tab", { name: "Resultados" }).click();
  await page.getByLabel("Nombre").fill("slow");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByText("La ejecución excedió el tiempo permitido.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ejecutar", exact: true })).toBeEnabled();
});

test("preserves workspace preferences and resets the visual layout", async ({ page }) => {
  await page.goto("/queries/query/builder");
  await expect(page.getByLabel("Lienzo de consulta")).toBeVisible();
  const catalogHandle = page.getByRole("separator", { name: "Redimensionar catálogo" });
  await catalogHandle.focus();
  await catalogHandle.press("ArrowRight");
  await page.getByRole("button", { name: "Ocultar catálogo" }).click();
  await page.waitForTimeout(180);
  await page.reload();
  await expect(page.getByRole("button", { name: "Mostrar catálogo" })).toBeVisible();
  await page.getByRole("button", { name: "Más acciones del constructor" }).click();
  await page.getByRole("menuitem", { name: "Restablecer diseño" }).click();
  await expect(page.getByRole("button", { name: "Ocultar catálogo" })).toBeVisible();
  await page.getByRole("button", { name: "Validar" }).click();
  await expect(page.getByRole("tab", { name: "Problemas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("uses the available viewport without document scroll at desktop sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/queries/query/builder");
    await expect(page.getByLabel("Catálogo de consulta")).toBeVisible();
    await expect(page.getByLabel("Lienzo de consulta")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
  }
});
