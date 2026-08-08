import type { Location } from "react-router";

export interface ReturnNavigationState {
  from?: string;
}

export function currentInternalPath(location: Pick<Location, "pathname" | "search" | "hash">) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function isSafeInternalPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
  );
}

export function resolveReturnPath(state: unknown, fallback: string) {
  const candidate = (state as ReturnNavigationState | null)?.from;
  return isSafeInternalPath(candidate) ? candidate : fallback;
}

export function returnState(location: Pick<Location, "pathname" | "search" | "hash">) {
  return { from: currentInternalPath(location) } satisfies ReturnNavigationState;
}
