import type {
  PhysicalRelationship,
  SchemaChange,
  SchemaEntity,
  SchemaEntitySummary,
  SchemaSummary,
  Synchronization,
} from "../types";
import { apiRequest } from "../../../shared/api/httpClient";

const base = (connectionId: string) => `/connections/${encodeURIComponent(connectionId)}/schema`;
export const synchronizeSchema = (connectionId: string) =>
  apiRequest<Synchronization>(`${base(connectionId)}/synchronize`, { method: "POST" });
export const getSchemaSummary = (connectionId: string) =>
  apiRequest<SchemaSummary>(`${base(connectionId)}/summary`);
export function listSchemaEntities(
  connectionId: string,
  filters: {
    search?: string;
    entityType?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.entityType) query.set("entity_type", filters.entityType);
  if (filters.isActive !== undefined) query.set("is_active", String(filters.isActive));
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("page_size", String(filters.pageSize));
  return apiRequest<{
    items: SchemaEntitySummary[];
    total: number;
    page: number;
    page_size: number;
  }>(`${base(connectionId)}/entities?${query}`);
}
export const getSchemaEntity = (connectionId: string, entityId: string) =>
  apiRequest<SchemaEntity>(`${base(connectionId)}/entities/${encodeURIComponent(entityId)}`);
export const listPhysicalRelationships = (connectionId: string) =>
  apiRequest<{ items: PhysicalRelationship[]; total: number }>(
    `${base(connectionId)}/relationships`,
  );
export const listSchemaSynchronizations = (connectionId: string) =>
  apiRequest<{ items: Synchronization[]; total: number }>(`${base(connectionId)}/synchronizations`);
export const getSchemaSynchronization = (connectionId: string, id: string) =>
  apiRequest<Synchronization>(`${base(connectionId)}/synchronizations/${encodeURIComponent(id)}`);
export const listSchemaChanges = (connectionId: string, synchronizationId?: string) => {
  const query = new URLSearchParams();
  if (synchronizationId) query.set("synchronization_id", synchronizationId);
  return apiRequest<{ items: SchemaChange[]; total: number }>(
    `${base(connectionId)}/changes?${query}`,
  );
};
