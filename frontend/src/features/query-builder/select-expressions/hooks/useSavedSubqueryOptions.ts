import { useQuery } from "@tanstack/react-query";

import { getQuery, listQueries } from "../../../queries/api/queriesApi";

export function useSavedSubqueryOptions(
  connectionId: string,
  active: boolean,
  selectedId: string | null,
) {
  const queries = useQuery({
    queryKey: ["select-expression-subqueries", connectionId],
    queryFn: () => listQueries(1, 100),
    enabled: active,
  });
  const options = (queries.data?.items ?? []).filter((item) => item.connection_id === connectionId);
  const selected = useQuery({
    queryKey: ["select-expression-subquery", selectedId],
    queryFn: () => getQuery(selectedId ?? ""),
    enabled: active && Boolean(selectedId),
  });
  return { options, selected: selected.data, loading: queries.isLoading || selected.isLoading };
}
