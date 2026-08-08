import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { QueryBuilderWorkspace } from "../features/query-builder/QueryBuilderWorkspace";
import { getQuery } from "../features/queries/api/queriesApi";

export function QueryBuilderPage() {
  const { id = "" } = useParams();
  const savedQuery = useQuery({ queryKey: ["query", id], queryFn: () => getQuery(id) });

  if (savedQuery.isPending) return <div className="state-message">Cargando constructor…</div>;
  if (savedQuery.isError)
    return <div className="alert-error m-6">No fue posible abrir el constructor.</div>;

  return (
    <QueryBuilderWorkspace
      key={`${savedQuery.data.id}-${String(savedQuery.data.revision)}`}
      savedQuery={savedQuery.data}
    />
  );
}
