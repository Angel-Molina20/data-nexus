import type {
  ConnectionDetail,
  ConnectionFormData,
  ConnectionList,
  PublicApiError,
  TestResult,
} from "../features/connections/types";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let error: PublicApiError | undefined;
    try {
      error = (await response.json()) as PublicApiError;
    } catch {
      error = undefined;
    }
    throw new ApiError(
      error?.message ?? "No fue posible completar la solicitud.",
      error?.code ?? "INTERNAL_ERROR",
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const testConnection = (data: ConnectionFormData) =>
  request<TestResult>("/connections/test", { method: "POST", body: JSON.stringify(data) });

export const createConnection = (data: ConnectionFormData) =>
  request<ConnectionDetail>("/connections", { method: "POST", body: JSON.stringify(data) });

export function listConnections(params: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  query.set("page", String(params.page ?? 1));
  return request<ConnectionList>(`/connections?${query}`);
}

export const getConnection = (id: string) =>
  request<ConnectionDetail>(`/connections/${encodeURIComponent(id)}`);

export const updateConnection = (
  id: string,
  data: Partial<ConnectionFormData>,
) =>
  request<ConnectionDetail>(`/connections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteConnection = (id: string) =>
  request<undefined>(`/connections/${encodeURIComponent(id)}`, { method: "DELETE" });

export const retestConnection = (id: string) =>
  request<TestResult>(`/connections/${encodeURIComponent(id)}/test`, { method: "POST" });
