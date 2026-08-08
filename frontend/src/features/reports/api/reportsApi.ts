import type { Report, ReportConfiguration, ReportExport, ReportPreview } from "../types";
import { apiRequest } from "../../../shared/api/httpClient";

export const listReports = (search = "", status = "", page = 1, pageSize = 20) =>
  apiRequest<{ items: Report[]; total: number; page: number; page_size: number }>(
    `/reports?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${String(page)}&page_size=${String(pageSize)}`,
  );
export const getReport = (id: string) => apiRequest<Report>(`/reports/${id}`);
export const createReport = (payload: {
  name: string;
  description: string | null;
  query_id: string;
  query_revision: number;
  configuration: ReportConfiguration;
}) => apiRequest<Report>("/reports", { method: "POST", body: JSON.stringify(payload) });
export const updateReport = (
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    query_revision?: number;
    configuration?: ReportConfiguration;
  },
) => apiRequest<Report>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteReport = (id: string) =>
  apiRequest<undefined>(`/reports/${id}`, { method: "DELETE" });
export const publishReport = (id: string) =>
  apiRequest<Report>(`/reports/${id}/publish`, { method: "POST" });
export const archiveReport = (id: string) =>
  apiRequest<Report>(`/reports/${id}/archive`, { method: "POST" });
export const previewReport = (id: string, parameters: Record<string, unknown>) =>
  apiRequest<ReportPreview>(`/reports/${id}/preview`, {
    method: "POST",
    body: JSON.stringify({ parameters, page: 1, page_size: 25 }),
  });
export const exportReport = (id: string, format: string, parameters: Record<string, unknown>) =>
  apiRequest<ReportExport>(`/reports/${id}/exports`, {
    method: "POST",
    body: JSON.stringify({ format, parameters, options: {} }),
  });
export const listReportExports = (reportId?: string) =>
  apiRequest<{ items: ReportExport[]; total: number }>(
    `/report-exports${reportId ? `?report_id=${encodeURIComponent(reportId)}` : ""}`,
  );
export const deleteReportExport = (id: string) =>
  apiRequest<undefined>(`/report-exports/${id}`, { method: "DELETE" });
export const reportExportDownloadUrl = (id: string) =>
  `/api/v1/report-exports/${encodeURIComponent(id)}/download`;
