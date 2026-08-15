export const QUERY_BUILDER_LAYOUT_KEY = "datanexus:query-builder:layout";

export interface QueryBuilderLayoutPreferences {
  version: 1;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
}

export const DEFAULT_QUERY_BUILDER_LAYOUT: QueryBuilderLayoutPreferences = {
  version: 1,
  leftWidth: 300,
  rightWidth: 360,
  bottomHeight: 280,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
};

const limits = {
  leftWidth: [240, 450],
  rightWidth: [280, 480],
  bottomHeight: [160, 520],
} as const;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const bounded = (value: unknown, [minimum, maximum]: readonly [number, number]) =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;

export function parseQueryBuilderLayoutPreferences(value: unknown): QueryBuilderLayoutPreferences {
  if (!value || typeof value !== "object") return DEFAULT_QUERY_BUILDER_LAYOUT;
  const candidate = value as Partial<QueryBuilderLayoutPreferences>;
  if (
    candidate.version !== 1 ||
    !bounded(candidate.leftWidth, limits.leftWidth) ||
    !bounded(candidate.rightWidth, limits.rightWidth) ||
    !bounded(candidate.bottomHeight, limits.bottomHeight) ||
    !isBoolean(candidate.leftCollapsed) ||
    !isBoolean(candidate.rightCollapsed) ||
    !isBoolean(candidate.bottomCollapsed)
  )
    return DEFAULT_QUERY_BUILDER_LAYOUT;
  return candidate as QueryBuilderLayoutPreferences;
}

export function loadQueryBuilderLayoutPreferences(
  storage: Pick<Storage, "getItem"> = window.localStorage,
) {
  try {
    const stored = storage.getItem(QUERY_BUILDER_LAYOUT_KEY);
    return stored
      ? parseQueryBuilderLayoutPreferences(JSON.parse(stored) as unknown)
      : DEFAULT_QUERY_BUILDER_LAYOUT;
  } catch {
    return DEFAULT_QUERY_BUILDER_LAYOUT;
  }
}

export function saveQueryBuilderLayoutPreferences(
  preferences: QueryBuilderLayoutPreferences,
  storage: Pick<Storage, "setItem"> = window.localStorage,
) {
  storage.setItem(QUERY_BUILDER_LAYOUT_KEY, JSON.stringify(preferences));
}

export function resetQueryBuilderLayoutPreferences(
  storage: Pick<Storage, "removeItem"> = window.localStorage,
) {
  storage.removeItem(QUERY_BUILDER_LAYOUT_KEY);
  return DEFAULT_QUERY_BUILDER_LAYOUT;
}

export { limits as queryBuilderLayoutLimits };
