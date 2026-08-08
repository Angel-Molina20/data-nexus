export const routes = {
  dashboard: () => "/",
  connections: {
    list: () => "/connections",
    create: () => "/connections/new",
    detail: (id: string) => `/connections/${encodeURIComponent(id)}`,
    edit: (id: string) => `/connections/${encodeURIComponent(id)}/edit`,
    schema: (id: string) => `/connections/${encodeURIComponent(id)}/schema`,
    relationships: (id: string) => `/connections/${encodeURIComponent(id)}/relationships`,
    semanticCatalog: (id: string) => `/connections/${encodeURIComponent(id)}/semantic-catalog`,
  },
  queries: {
    list: () => "/queries",
    create: () => "/queries/new",
    detail: (id: string) => `/queries/${encodeURIComponent(id)}`,
    builder: (id: string) => `/queries/${encodeURIComponent(id)}/builder`,
    editJson: (id: string) => `/queries/${encodeURIComponent(id)}/edit-json`,
    compile: (id: string) => `/queries/${encodeURIComponent(id)}/compile`,
  },
  reports: {
    list: () => "/reports",
    create: () => "/reports/new",
    detail: (id: string) => `/reports/${encodeURIComponent(id)}`,
    edit: (id: string) => `/reports/${encodeURIComponent(id)}/edit`,
  },
} as const;
