import { apiRequest } from "../../../shared/api/httpClient";
import type { DashboardSummary } from "../types";

export const getDashboardSummary = () => apiRequest<DashboardSummary>("/dashboard/summary");
