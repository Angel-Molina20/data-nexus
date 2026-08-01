import type { Complexity, QueryDocument, SavedQuery, SavedQueryList, ValidationResult } from "../features/queries/types";
import { apiRequest } from "./shared";

export const getQueryModelSchema = () => apiRequest<Record<string, unknown>>("/query-model/schema");
export const validateQueryModel = (document: QueryDocument) => apiRequest<ValidationResult>("/query-model/validate", { method: "POST", body: JSON.stringify(document) });
export const normalizeQueryModel = (document: QueryDocument) => apiRequest<{ normalized_query: QueryDocument; fingerprint: string }>("/query-model/normalize", { method: "POST", body: JSON.stringify(document) });
export const calculateQueryComplexity = (document: QueryDocument) => apiRequest<Complexity>("/query-model/complexity", { method: "POST", body: JSON.stringify(document) });
export const listQueries = () => apiRequest<SavedQueryList>("/queries");
export const createQuery = (payload: { name: string; description: string | null; document: QueryDocument }) => apiRequest<SavedQuery>("/queries", { method: "POST", body: JSON.stringify(payload) });
export const getQuery = (id: string) => apiRequest<SavedQuery>(`/queries/${id}`);
export const updateQuery = (id: string, payload: { revision: number; name?: string; description?: string | null; document?: QueryDocument }) => apiRequest<SavedQuery>(`/queries/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteQuery = (id: string) => apiRequest<undefined>(`/queries/${id}`, { method: "DELETE" });
export const archiveQuery = (id: string) => apiRequest<SavedQuery>(`/queries/${id}/archive`, { method: "POST" });
export const duplicateQuery = (id: string) => apiRequest<SavedQuery>(`/queries/${id}/duplicate`, { method: "POST" });
export const validateSavedQuery = (id: string) => apiRequest<ValidationResult>(`/queries/${id}/validate`, { method: "POST" });
