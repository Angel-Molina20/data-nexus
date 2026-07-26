export type ConnectionStatus = "connected" | "disconnected" | "error" | "testing";
export type Provider = "mysql" | "percona" | "mariadb" | "unknown";

export interface ConnectionFormData {
  name: string;
  engine: "mysql";
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl_enabled: boolean;
  configuration: Record<string, unknown>;
}

export interface Capabilities {
  supports_subqueries: boolean;
  supports_derived_tables: boolean;
  supports_joins: boolean;
  supports_grouping: boolean;
  supports_union: boolean;
  supports_cte: boolean;
  supports_recursive_cte: boolean;
  supports_window_functions: boolean;
  supports_json_type: boolean;
  supports_json_table: boolean;
  supports_explain_json: boolean;
  supports_explain_tree: boolean;
  supports_explain_analyze: boolean;
}

export interface TestResult {
  success: true;
  server: {
    engine: "mysql";
    provider: Provider;
    raw_version: string;
    version: { major: number; minor: number; patch: number };
    version_comment: string | null;
    sql_mode: string | null;
    character_set: string | null;
    collation: string | null;
    timezone: string | null;
    current_database: string | null;
  };
  capabilities: Capabilities;
  warnings: string[];
}

export interface ConnectionSummary {
  id: string;
  name: string;
  engine: "mysql";
  provider: Provider;
  host: string;
  port: number;
  database_name: string;
  status: ConnectionStatus;
  raw_version: string | null;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionDetail extends ConnectionSummary {
  username: string;
  ssl_enabled: boolean;
  configuration: Record<string, unknown>;
  version: { major: number; minor: number; patch: number } | null;
  version_comment: string | null;
  sql_mode: string | null;
  character_set: string | null;
  collation: string | null;
  timezone: string | null;
  capabilities: Capabilities;
  last_error_code: string | null;
  last_error_message: string | null;
}

export interface ConnectionList {
  items: ConnectionSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface PublicApiError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}
