import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { archiveReport, deleteReport, listReports, publishReport } from "../api/reportsApi";

export type ReportAction = "publish" | "archive" | "delete";

export function useReportsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["reports", search, status],
    queryFn: () => listReports(search, status),
  });
  const action = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: ReportAction }) => {
      if (name === "publish") return publishReport(id);
      if (name === "archive") return archiveReport(id);
      await deleteReport(id);
      return undefined;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  const confirmAction = (id: string, name: Exclude<ReportAction, "publish">) => {
    const message =
      name === "archive" ? "¿Archivar este reporte?" : "¿Eliminar el reporte y sus archivos?";
    if (window.confirm(message)) action.mutate({ id, name });
  };

  return { action, confirmAction, filters: { search, status }, reports, setSearch, setStatus };
}
