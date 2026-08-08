import type { ConnectionDetail, ConnectionFormData, ConnectionList, TestResult } from "../types";
import { apiRequest } from "../../../shared/api/httpClient";

export const testConnection = (data: ConnectionFormData) =>
  apiRequest<TestResult>("/connections/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const createConnection = (data: ConnectionFormData) =>
  apiRequest<ConnectionDetail>("/connections", {
    method: "POST",
    body: JSON.stringify(data),
  });
export function listConnections(params: { search?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  query.set("page", String(params.page ?? 1));
  return apiRequest<ConnectionList>(`/connections?${query}`);
}
export const getConnection = (id: string) =>
  apiRequest<ConnectionDetail>(`/connections/${encodeURIComponent(id)}`);
export const updateConnection = (id: string, data: Partial<ConnectionFormData>) =>
  apiRequest<ConnectionDetail>(`/connections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteConnection = (id: string) =>
  apiRequest<undefined>(`/connections/${encodeURIComponent(id)}`, { method: "DELETE" });
export const retestConnection = (id: string) =>
  apiRequest<TestResult>(`/connections/${encodeURIComponent(id)}/test`, { method: "POST" });
