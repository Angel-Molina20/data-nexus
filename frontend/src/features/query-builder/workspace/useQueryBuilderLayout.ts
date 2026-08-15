import { useEffect, useState } from "react";

import {
  DEFAULT_QUERY_BUILDER_LAYOUT,
  loadQueryBuilderLayoutPreferences,
  resetQueryBuilderLayoutPreferences,
  saveQueryBuilderLayoutPreferences,
  type QueryBuilderLayoutPreferences,
} from "./queryBuilderLayoutPreferences";

export function useQueryBuilderLayout() {
  const [preferences, setPreferences] = useState(loadQueryBuilderLayoutPreferences);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveQueryBuilderLayoutPreferences(preferences);
    }, 120);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [preferences]);

  const update = (patch: Partial<QueryBuilderLayoutPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  };
  const reset = () => {
    resetQueryBuilderLayoutPreferences();
    setPreferences(DEFAULT_QUERY_BUILDER_LAYOUT);
    setFocusMode(false);
  };

  return { focusMode, preferences, reset, setFocusMode, update };
}
