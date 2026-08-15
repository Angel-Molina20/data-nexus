import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_QUERY_BUILDER_LAYOUT,
  QUERY_BUILDER_LAYOUT_KEY,
  loadQueryBuilderLayoutPreferences,
  resetQueryBuilderLayoutPreferences,
  saveQueryBuilderLayoutPreferences,
} from "./queryBuilderLayoutPreferences";

describe("query builder layout preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses defaults when storage is empty or corrupt", () => {
    expect(loadQueryBuilderLayoutPreferences()).toEqual(DEFAULT_QUERY_BUILDER_LAYOUT);
    localStorage.setItem(QUERY_BUILDER_LAYOUT_KEY, "not-json");
    expect(loadQueryBuilderLayoutPreferences()).toEqual(DEFAULT_QUERY_BUILDER_LAYOUT);
    localStorage.setItem(
      QUERY_BUILDER_LAYOUT_KEY,
      JSON.stringify({ ...DEFAULT_QUERY_BUILDER_LAYOUT, leftWidth: 9999 }),
    );
    expect(loadQueryBuilderLayoutPreferences()).toEqual(DEFAULT_QUERY_BUILDER_LAYOUT);
  });

  it("persists, restores and resets valid visual preferences", () => {
    const preferences = {
      ...DEFAULT_QUERY_BUILDER_LAYOUT,
      leftWidth: 340,
      bottomHeight: 320,
      rightCollapsed: true,
    };
    saveQueryBuilderLayoutPreferences(preferences);
    expect(loadQueryBuilderLayoutPreferences()).toEqual(preferences);
    expect(resetQueryBuilderLayoutPreferences()).toEqual(DEFAULT_QUERY_BUILDER_LAYOUT);
    expect(localStorage.getItem(QUERY_BUILDER_LAYOUT_KEY)).toBeNull();
  });
});
