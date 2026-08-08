export type RelationshipStatus = "suggested" | "confirmed" | "rejected" | "invalid" | "disabled";

export interface RelationshipEndpoint {
  entity_id: string;
  entity_name: string;
  display_name: string;
  fields: string[];
}

export interface UnifiedRelationship {
  id: string;
  type: "physical" | "inferred" | "manual" | "polymorphic";
  status: RelationshipStatus;
  detection_source: string;
  source: RelationshipEndpoint;
  target: RelationshipEndpoint | null;
  name: string;
  display_name: string;
  description: string | null;
  cardinality: string;
  confidence: number;
  conditions: Array<Record<string, unknown>>;
  reasons: string[];
  warnings: string[];
  enabled: boolean;
  invalid_reason: string | null;
  fingerprint?: string | null;
}

export interface RelationshipList {
  items: UnifiedRelationship[];
  total: number;
  physical: number;
  confirmed: number;
  suggested: number;
  polymorphic: number;
  invalid: number;
  bridge_candidates: Array<{
    entity_id: string;
    entity_name: string;
    reference_fields: string[];
    message: string;
  }>;
}

export interface RelationshipGraph {
  nodes: Array<{
    id: string;
    physical_name: string;
    display_name: string;
    entity_type: string;
    is_active: boolean;
    key_fields: string[];
    sensitive_fields: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship_type: string;
    status: string;
    label: string;
  }>;
  truncated: boolean;
}

export interface SemanticField {
  id: string;
  physical_name: string;
  display_name: string;
  description: string | null;
  semantic_type: string;
  format: string | null;
  tags: string[];
  is_visible: boolean;
  is_sensitive: boolean;
  is_active: boolean;
}

export interface SemanticEntity {
  id: string;
  physical_name: string;
  display_name: string;
  singular_name: string | null;
  plural_name: string | null;
  description: string | null;
  business_domain: string | null;
  tags: string[];
  is_visible: boolean;
  is_active: boolean;
  sensitive_fields: number;
  fields: SemanticField[];
  updated_at: string | null;
}
