import type { ExecutionInfo, ExecutionRequest, ExecutionResult } from "../features/query-execution/types";
import { apiRequest } from "./shared";

export const executeQuery = (payload: ExecutionRequest, signal?: AbortSignal) => apiRequest<ExecutionResult>("/query-executions", { method: "POST", body: JSON.stringify(payload), signal });
export const cancelExecution = (id: string) => apiRequest<{ execution: ExecutionInfo; cancellation_supported: boolean }>(`/query-executions/${id}/cancel`, { method: "POST" });
export const listExecutions = (queryId: string) => apiRequest<{ items: ExecutionInfo[]; page: number; page_size: number }>(`/query-executions?query_id=${encodeURIComponent(queryId)}`);
