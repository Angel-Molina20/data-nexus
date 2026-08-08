import type { QueryDocument } from "../queries/types";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";
export interface ExecutionColumn {
  key: string;
  label: string;
  data_type: string;
  nullable: boolean;
  source: string | null;
  format: string | null;
}
export interface ExecutionInfo {
  id: string;
  connection_id: string;
  query_id: string | null;
  query_revision: number | null;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  row_count: number;
  returned_row_count: number;
  truncated: boolean;
  page: number;
  page_size: number;
  total_rows: number | null;
  total_pages: number | null;
  error_code: string | null;
  error_message: string | null;
}
export interface ExecutionResult {
  execution: ExecutionInfo;
  columns: ExecutionColumn[];
  rows: Array<Record<string, unknown>>;
  warnings: string[];
  metadata: {
    database_engine: string;
    database_version: string | null;
    compiled_sql: string | null;
  };
}
export interface ExecutionRequest {
  execution_id?: string;
  connection_id: string;
  query_id?: string;
  query_revision?: number;
  ast: QueryDocument;
  parameters: Record<string, unknown>;
  pagination: { page: number; page_size: number };
  options: { include_total_count: boolean; include_compiled_sql: boolean };
}
