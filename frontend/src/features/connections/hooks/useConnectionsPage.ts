import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { deleteConnection, listConnections, retestConnection } from "../api/connectionsApi";

export function useConnectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("page_size"), 20);
  const queryClient = useQueryClient();
  const connections = useQuery({
    queryKey: ["connections", search, status, page, pageSize],
    queryFn: () => listConnections({ search, status, page, pageSize }),
  });
  const removeConnection = useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });
  const retest = useMutation({
    mutationFn: retestConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });

  const requestDelete = (connectionId: string, connectionName: string) => {
    const confirmed = window.confirm(
      `¿Eliminar la conexión “${connectionName}”? Solo se borrará su configuración local.`,
    );
    if (confirmed) removeConnection.mutate(connectionId);
  };

  const updateParams = (patch: Record<string, string | number | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    });
  };

  return {
    connections,
    filters: { page, pageSize, search, status },
    isDeleting: removeConnection.isPending,
    isRetesting: retest.isPending,
    requestDelete,
    retestConnection: retest.mutate,
    setPage: (value: number) => {
      updateParams({ page: value });
    },
    setPageSize: (value: number) => {
      updateParams({ page: 1, page_size: value });
    },
    setSearch: (value: string) => {
      updateParams({ page: 1, search: value });
    },
    setStatus: (value: string) => {
      updateParams({ page: 1, status: value });
    },
  };
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
