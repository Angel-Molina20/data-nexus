export type BackendStatusValue = "checking" | "available" | "unavailable";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
let healthCheckPromise: Promise<BackendStatusValue> | undefined;

function isHealthResponse(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return response.status === "ok" && response.service === "datanexus-api";
}

export async function checkBackendHealth(signal?: AbortSignal): Promise<BackendStatusValue> {
  if (!apiBaseUrl) {
    return "unavailable";
  }

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!response.ok) {
      return "unavailable";
    }

    const data: unknown = await response.json();
    return isHealthResponse(data) ? "available" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function checkBackendHealthOnce(): Promise<BackendStatusValue> {
  healthCheckPromise ??= checkBackendHealth();
  return healthCheckPromise;
}
