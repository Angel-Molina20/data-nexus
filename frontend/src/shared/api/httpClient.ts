interface PublicApiError {
  code: string;
  message: string;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearCsrfToken() {
  csrfToken = null;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${apiBase}/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new ApiError("La sesión no es válida.", "AUTHENTICATION_REQUIRED");
  csrfToken = ((await response.json()) as { csrf_token: string }).csrf_token;
  return csrfToken;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { csrf?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const method = (init?.method ?? "GET").toUpperCase();
  if (options?.csrf !== false && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401) {
    clearCsrfToken();
    unauthorizedHandler?.();
  }
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
