import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "user-id",
  email: "analyst@example.test",
  full_name: "Ana Molina",
  status: "active",
  roles: ["analyst"],
  permissions: [
    "connections.read",
    "queries.read",
    "queries.create",
    "queries.update",
    "queries.execute",
    "queries.compile",
    "reports.read",
  ],
  must_change_password: false,
};

const savedQuery = {
  id: "query-id",
  name: "Usuarios activos",
  description: "Consulta contextual",
  connection_id: "connection-id",
  owner_user_id: "user-id",
  document: {
    schema_version: "1.0",
    connection_id: "connection-id",
    query: {
      scope_id: "root",
      query_type: "select",
      source: { source_id: "source-id", entity_id: "entity-id", alias: "users" },
      joins: [],
      select: [],
      group_by: [],
      order_by: [],
      distinct: false,
      unions: [],
    },
    parameters: [],
    metadata: {
      builder_layout: {
        nodes: { "source-id": { x: 100, y: 80, collapsed: false } },
        panels: { catalog_width: 280, inspector_width: 360 },
      },
    },
    options: {},
  },
  schema_version: "1.0",
  status: "draft",
  validation_status: "valid",
  validation_errors: [],
  validation_warnings: [],
  fingerprint: null,
  complexity: null,
  revision: 1,
  last_validated_at: null,
  created_at: "2026-08-08T12:00:00Z",
  updated_at: "2026-08-08T17:00:00Z",
};

async function mockNavigationApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/auth/me")) return json(user);
    if (path.endsWith("/health")) return json({ status: "ok", service: "datanexus-api" });
    if (path.endsWith("/queries") && method === "GET") {
      return json({ items: [savedQuery], total: 30, page: 2, page_size: 25 });
    }
    if (path.endsWith("/queries") && method === "POST") return json(savedQuery, 201);
    if (path.endsWith("/queries/query-id")) return json(savedQuery);
    if (path.endsWith("/connections") && method === "GET") {
      return json({
        items: [{ id: "connection-id", name: "Analítica", engine: "mysql" }],
        total: 1,
        page: 1,
        page_size: 20,
      });
    }
    if (path.endsWith("/connections/connection-id")) {
      return json({
        id: "connection-id",
        name: "Analítica",
        engine: "mysql",
        raw_version: "8.4.10",
      });
    }
    if (path.endsWith("/connections/connection-id/schema/entities/entity-id")) {
      return json({ id: "entity-id", display_name: "Usuarios", fields: [], indexes: [] });
    }
    if (path.endsWith("/connections/connection-id/schema/entities")) {
      return json({ items: [{ id: "entity-id", display_name: "Usuarios" }] });
    }
    return json({ items: [] });
  });
}

test("preserves the query-list URL through detail, browser history and deep links", async ({
  page,
}) => {
  await mockNavigationApi(page);
  await page.goto("/queries?page=2&page_size=25");
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await page.getByRole("link", { name: "Usuarios activos" }).click();
  await expect(page).toHaveURL(/\/queries\/query-id$/);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/queries\?page=2&page_size=25$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/queries\/query-id$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/queries\?page=2&page_size=25$/);

  await page.goto("/queries/query-id");
  await page.reload();
  await expect(page.getByRole("link", { name: "Volver" })).toHaveAttribute("href", "/queries");
});

test("blocks a dirty creation form and stops warning after a successful save", async ({ page }) => {
  await mockNavigationApi(page);
  await page.goto("/queries/new");
  await page.getByLabel("Nombre").fill("Nueva consulta");
  await page
    .getByRole("navigation", { name: "Migas de pan" })
    .getByRole("link", { name: "Consultas", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Tienes cambios sin guardar" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.getByLabel("Conexión").selectOption("connection-id");
  await page.getByLabel("Entidad principal").selectOption("entity-id");
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(page).toHaveURL(/\/queries\/query-id\/builder$/);
  await expect(page.getByRole("dialog", { name: "Tienes cambios sin guardar" })).toHaveCount(0);
});
