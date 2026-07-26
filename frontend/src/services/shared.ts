import type { PublicApiError } from "../features/connections/types";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export class ApiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    let error: PublicApiError | undefined;
    try { error = (await response.json()) as PublicApiError; } catch { error = undefined; }
    throw new ApiError(
      error?.message ?? "No fue posible completar la solicitud.",
      error?.code ?? "INTERNAL_ERROR",
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
