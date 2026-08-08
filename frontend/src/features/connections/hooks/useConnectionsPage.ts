import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { deleteConnection, listConnections, retestConnection } from "../api/connectionsApi";

export function useConnectionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const connections = useQuery({
    queryKey: ["connections", search, status],
    queryFn: () => listConnections({ search, status }),
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

  return {
    connections,
    filters: { search, status },
    isDeleting: removeConnection.isPending,
    isRetesting: retest.isPending,
    requestDelete,
    retestConnection: retest.mutate,
    setSearch,
    setStatus,
  };
}
