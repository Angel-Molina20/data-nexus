import { expect, test } from "@playwright/test";

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
    "queries.execute",
    "reports.read",
  ],
  must_change_password: false,
};

test("opens a quick action from the dashboard and returns through existing navigation", async ({
  page,
}) => {
  const viewportWidth = Number(process.env.DASHBOARD_VIEWPORT_WIDTH ?? 1280);
  const viewportHeight = Number(process.env.DASHBOARD_VIEWPORT_HEIGHT ?? 720);
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({
        status: authenticated ? 200 : 401,
        contentType: "application/json",
        body: JSON.stringify(
          authenticated
            ? user
            : { code: "AUTHENTICATION_REQUIRED", message: "Debes iniciar sesión." },
        ),
      });
    }
    if (path.endsWith("/auth/login")) {
      authenticated = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      });
    }
    if (path.endsWith("/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", service: "datanexus-api" }),
      });
    }
    if (path.endsWith("/dashboard/summary")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generated_at: "2026-08-08T17:00:00Z",
          execution_period_started_at: "2026-08-07T17:00:00Z",
          connections: {
            available: true,
            total: 2,
            connected: 2,
            items: [
              {
                id: "connection-id",
                name: "Analítica principal",
                engine: "mysql",
                detected_version: "8.4.10",
                status: "connected",
                updated_at: "2026-08-08T15:45:00Z",
              },
            ],
          },
          queries: {
            available: true,
            total: 1,
            items: [
              {
                id: "query-id",
                name: "Usuarios activos",
                connection_id: "connection-id",
                status: "draft",
                validation_status: "valid",
                updated_at: "2026-08-08T16:00:00Z",
              },
            ],
          },
          executions: {
            available: true,
            last_24_hours: 3,
            items: [
              {
                id: "execution-id",
                query_id: "query-id",
                query_name: "Usuarios activos",
                status: "completed",
                duration_ms: 384,
                row_count: 1245,
                started_at: "2026-08-08T16:30:00Z",
              },
            ],
          },
          reports: {
            available: true,
            total: 1,
            published: 1,
            items: [
              {
                id: "report-id",
                name: "Resumen de usuarios",
                query_id: "query-id",
                query_name: "Usuarios activos",
                status: "published",
                updated_at: "2026-08-08T15:00:00Z",
              },
            ],
          },
        }),
      });
    }
    if (path.endsWith("/connections")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      });
    }
    return route.fallback();
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("analyst@example.test");
  await page.getByRole("textbox", { name: /^Contraseña/ }).fill("valid-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("heading", { name: "Bienvenido, Ana" })).toBeVisible();
  await expect(page.getByText("Consultas guardadas")).toBeVisible();
  await page.getByRole("link", { name: "Nueva consulta" }).click();
  await expect(page.getByRole("heading", { name: "Nueva consulta" })).toBeVisible();
  if (viewportWidth < 1024) {
    await page.getByRole("button", { name: "Abrir menú principal" }).click();
  }
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido, Ana" })).toBeVisible();
  if (process.env.DASHBOARD_SCREENSHOT_PATH) {
    await page.screenshot({ fullPage: true, path: process.env.DASHBOARD_SCREENSHOT_PATH });
  }
});
