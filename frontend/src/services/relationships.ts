import type {
  RelationshipGraph,
  RelationshipList,
  SemanticEntity,
  SemanticField,
  UnifiedRelationship,
} from "../features/relationships/types";
import { apiRequest } from "./shared";

const base = (connectionId: string) =>
  `/connections/${encodeURIComponent(connectionId)}/relationships`;
const semanticBase = (connectionId: string) =>
  `/connections/${encodeURIComponent(connectionId)}/semantic`;

export const listRelationships = (connectionId: string) =>
  apiRequest<RelationshipList>(base(connectionId));
export const getRelationshipGraph = (connectionId: string) =>
  apiRequest<RelationshipGraph>(`${base(connectionId)}/graph`);
export const listRelationshipCandidates = (connectionId: string) =>
  apiRequest<RelationshipList>(`${base(connectionId)}/candidates`);
export const detectRelationshipCandidates = (connectionId: string) =>
  apiRequest<{ detected: number; created: number; preserved_rejections: number }>(
    `${base(connectionId)}/detect`,
    { method: "POST" },
  );
export const confirmRelationshipCandidate = (
  connectionId: string,
  candidateId: string,
  payload: Record<string, unknown> = {},
) =>
  apiRequest<UnifiedRelationship>(
    `${base(connectionId)}/candidates/${encodeURIComponent(candidateId)}/confirm`,
    { method: "POST", body: JSON.stringify(payload) },
  );
export const rejectRelationshipCandidate = (
  connectionId: string,
  candidateId: string,
) =>
  apiRequest<UnifiedRelationship>(
    `${base(connectionId)}/candidates/${encodeURIComponent(candidateId)}/reject`,
    { method: "POST" },
  );
export const createManualRelationship = (
  connectionId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<UnifiedRelationship>(`${base(connectionId)}/manual`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateRelationship = (
  connectionId: string,
  relationshipId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<UnifiedRelationship>(
    `${base(connectionId)}/${encodeURIComponent(relationshipId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
export const deleteRelationship = (connectionId: string, relationshipId: string) =>
  apiRequest<unknown>(`${base(connectionId)}/${encodeURIComponent(relationshipId)}`, {
    method: "DELETE",
  });
export const enableRelationship = (connectionId: string, relationshipId: string) =>
  apiRequest<UnifiedRelationship>(
    `${base(connectionId)}/${encodeURIComponent(relationshipId)}/enable`,
    { method: "POST" },
  );
export const disableRelationship = (connectionId: string, relationshipId: string) =>
  apiRequest<UnifiedRelationship>(
    `${base(connectionId)}/${encodeURIComponent(relationshipId)}/disable`,
    { method: "POST" },
  );
export const createPolymorphicRelationship = (
  connectionId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<Record<string, unknown>>(`${base(connectionId)}/polymorphic`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const getPolymorphicRelationship = (connectionId: string, relationshipId: string) =>
  apiRequest<{
    id: string; source_entity_id: string; source_entity: string; type_field_id: string;
    type_field: string; id_field_id: string; id_field: string; name: string;
    display_name: string; status: string; is_enabled: boolean; invalid_reason: string | null;
    mappings: Array<{ id: string; type_value: string; target_entity_id: string; target_entity: string; target_field_id: string; target_field: string; display_name: string; is_enabled: boolean }>;
  }>(`${base(connectionId)}/polymorphic/${encodeURIComponent(relationshipId)}`);
export const addPolymorphicMapping = (
  connectionId: string,
  relationshipId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<Record<string, unknown>>(
    `${base(connectionId)}/polymorphic/${encodeURIComponent(relationshipId)}/mappings`,
    { method: "POST", body: JSON.stringify(payload) },
  );
export const updatePolymorphicMapping = (
  connectionId: string,
  relationshipId: string,
  mappingId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<Record<string, unknown>>(
    `${base(connectionId)}/polymorphic/${encodeURIComponent(relationshipId)}/mappings/${encodeURIComponent(mappingId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
export const deletePolymorphicMapping = (
  connectionId: string,
  relationshipId: string,
  mappingId: string,
) =>
  apiRequest<unknown>(
    `${base(connectionId)}/polymorphic/${encodeURIComponent(relationshipId)}/mappings/${encodeURIComponent(mappingId)}`,
    { method: "DELETE" },
  );
export const listSemanticEntities = (connectionId: string) =>
  apiRequest<{ items: SemanticEntity[]; total: number }>(
    `${semanticBase(connectionId)}/entities`,
  );
export const getSemanticEntity = (connectionId: string, entityId: string) =>
  apiRequest<SemanticEntity>(
    `${semanticBase(connectionId)}/entities/${encodeURIComponent(entityId)}`,
  );
export const updateSemanticEntity = (
  connectionId: string,
  entityId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<SemanticEntity>(
    `${semanticBase(connectionId)}/entities/${encodeURIComponent(entityId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
export const updateSemanticField = (
  connectionId: string,
  fieldId: string,
  payload: Record<string, unknown>,
) =>
  apiRequest<SemanticField>(
    `${semanticBase(connectionId)}/fields/${encodeURIComponent(fieldId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
