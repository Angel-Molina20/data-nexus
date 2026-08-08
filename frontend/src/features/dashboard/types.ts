export interface DashboardRecentConnection {
  id: string;
  name: string;
  engine: string;
  provider: string;
  raw_version: string | null;
  status: string;
  updated_at: string;
}

export interface DashboardRecentQuery {
  id: string;
  name: string;
  connection_id: string;
  status: string;
  validation_status: string;
  updated_at: string;
}

export interface DashboardRecentExecution {
  id: string;
  query_id: string | null;
  query_name: string | null;
  status: string;
  duration_ms: number | null;
  row_count: number;
  started_at: string;
}

export interface DashboardRecentReport {
  id: string;
  name: string;
  query_id: string;
  query_name: string | null;
  status: string;
  updated_at: string;
}

export interface DashboardSummary {
  generated_at: string;
  execution_period_started_at: string;
  connections: {
    available: boolean;
    total: number | null;
    connected: number | null;
    items: DashboardRecentConnection[];
  };
  queries: {
    available: boolean;
    total: number | null;
    items: DashboardRecentQuery[];
  };
  executions: {
    available: boolean;
    last_24_hours: number | null;
    items: DashboardRecentExecution[];
  };
  reports: {
    available: boolean;
    total: number | null;
    published: number | null;
    items: DashboardRecentReport[];
  };
}
