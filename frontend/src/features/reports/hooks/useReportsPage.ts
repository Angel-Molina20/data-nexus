import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { archiveReport, deleteReport, listReports, publishReport } from "../api/reportsApi";

export type ReportAction = "publish" | "archive" | "delete";

export function useReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("page_size"), 20);
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["reports", search, status, page, pageSize],
    queryFn: () => listReports(search, status, page, pageSize),
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
    action,
    confirmAction,
    filters: { page, pageSize, search, status },
    reports,
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
