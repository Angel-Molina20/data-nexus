import { useQuery } from "@tanstack/react-query";

import { getDashboardSummary } from "../api/dashboardApi";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 30_000,
  });
}
