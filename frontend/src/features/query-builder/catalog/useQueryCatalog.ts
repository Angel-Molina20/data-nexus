import { useInfiniteQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { listSchemaEntities } from "../../schema/api/schemaApi";

const PAGE_SIZE = 100;

export function useQueryCatalog(connectionId: string) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search.trim());
  const query = useInfiniteQuery({
    queryKey: ["builder-entities", connectionId, deferredSearch],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listSchemaEntities(connectionId, {
        search: deferredSearch || undefined,
        isActive: true,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.page_size;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const entities = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return {
    entities,
    expanded,
    isExpanded: (entityId: string) => Boolean(deferredSearch) || expanded.has(entityId),
    query,
    search,
    searching: search !== deferredSearch || query.isFetching,
    setSearch,
    toggle(entityId: string) {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(entityId)) next.delete(entityId);
        else next.add(entityId);
        return next;
      });
    },
    collapseAll() {
      setExpanded(new Set());
    },
  };
}
