import { expect, test } from "@playwright/test";

const configuration = {
  version: 1,
  layout: { orientation: "landscape", page_size: "A4", show_generated_at: true, show_page_numbers: true },
  header: { title: "Estudiantes activos", subtitle: "Ciclo 2026", description: null },
  columns: [{ source_key: "name", label: "Estudiante", visible: true, position: 0, alignment: "left", format: { type: "text", null_label: "NULL", true_label: "Sí", false_label: "No" } }],
  footer: { text: "DataNexus", show_row_count: true }, locale: "es-EC", timezone: "America/Guayaquil", parameters: {},
};

test("previews and exports a pinned report to CSV, Excel and PDF", async ({ page }) => {
  const formats: string[] = [];
  const report = { id: "report", name: "Estudiantes", description: "Listado", query_id: "query", query_revision: 3, connection_id: "connection", status: "published", title: "Estudiantes activos", subtitle: "Ciclo 2026", configuration, configuration_version: 1, created_by: "user", published_at: "2026-08-07T00:00:00Z", archived_at: null, created_at: "2026-08-07T00:00:00Z", updated_at: "2026-08-07T00:00:00Z", compatible: true, warnings: [] };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/auth/me")) return json({ id: "user", email: "analyst@example.test", full_name: "Analista", status: "active", roles: ["analyst"], permissions: ["reports.read", "reports.update", "reports.publish", "reports.execute", "reports.export", "reports.download"], must_change_password: false });
    if (path.endsWith("/auth/csrf")) return json({ csrf_token: "csrf" });
    if (path.endsWith("/reports/report/preview")) return json({ report, execution: { id: "execution", connection_id: "connection", query_id: null, query_revision: null, status: "completed", started_at: "2026-08-07T00:00:00Z", finished_at: "2026-08-07T00:00:01Z", duration_ms: 25, row_count: 1, returned_row_count: 1, truncated: false, page: 1, page_size: 25, total_rows: null, total_pages: null, error_code: null, error_message: null }, columns: [{ key: "name", label: "Estudiante", data_type: "string", nullable: false, source: null, format: "text" }], rows: [{ name: "Ada Lovelace" }], warnings: [] });
    if (path.endsWith("/reports/report/exports")) { const payload = route.request().postDataJSON() as { format: string }; formats.push(payload.format); return json({ id: `export-${payload.format}`, report_id: "report", query_id: "query", query_revision: 3, execution_id: "execution", requested_by: "user", format: payload.format, status: "completed", file_name: `estudiantes.${payload.format}`, content_type: "application/octet-stream", row_count: 1, file_size: 1000, started_at: "2026-08-07T00:00:00Z", finished_at: "2026-08-07T00:00:01Z", expires_at: "2026-08-14T00:00:00Z", error_code: null, error_message: null, created_at: "2026-08-07T00:00:00Z", download_url: `/api/v1/report-exports/export-${payload.format}/download` }, 201); }
    if (path.endsWith("/report-exports")) return json({ items: formats.map((format) => ({ id: `export-${format}`, report_id: "report", query_id: "query", query_revision: 3, execution_id: "execution", requested_by: "user", format, status: "completed", file_name: `estudiantes.${format}`, content_type: "application/octet-stream", row_count: 1, file_size: 1000, started_at: "2026-08-07T00:00:00Z", finished_at: "2026-08-07T00:00:01Z", expires_at: "2026-08-14T00:00:00Z", error_code: null, error_message: null, created_at: "2026-08-07T00:00:00Z", download_url: `/api/v1/report-exports/export-${format}/download` })), total: formats.length });
    if (path.endsWith("/queries/query")) return json({ id: "query", document: { parameters: [] } });
    if (path.endsWith("/reports/report")) return json(report);
    return json({});
  });

  await page.goto("/reports/report");
  await expect(page.getByRole("heading", { name: "Estudiantes activos" })).toBeVisible();
  await page.getByRole("button", { name: "Vista previa" }).click();
  await expect(page.getByRole("cell", { name: "Ada Lovelace" })).toBeVisible();
  for (const format of ["csv", "xlsx", "pdf"]) {
    await page.getByLabel("Formato de exportación").selectOption(format);
    await page.getByRole("button", { name: "Exportar" }).click();
    await expect.poll(() => formats).toContain(format);
  }
  await expect(page.getByRole("link", { name: "Descargar" }).first()).toBeVisible();
});
