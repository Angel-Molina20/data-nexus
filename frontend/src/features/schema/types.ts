export interface SchemaSummary {
  connection_id: string;
  connection_name: string;
  engine: string;
  raw_version: string | null;
  last_synchronized_at: string | null;
  status: string | null;
  tables: number;
  views: number;
  inactive_entities: number;
  fields: number;
  indexes: number;
  physical_relationships: number;
  latest_added: number;
  latest_updated: number;
  latest_removed: number;
  warnings: string[];
}
export interface SchemaEntitySummary {
  id: string;
  schema_name: string;
  physical_name: string;
  display_name: string;
  entity_type: "table" | "view";
  is_active: boolean;
  fields_count: number;
  has_primary_key: boolean;
  indexes_count: number;
  relationships_count: number;
}
export interface PhysicalRelationship {
  id: string;
  constraint_name: string;
  source_entity_id: string;
  source_entity: string;
  target_entity_id: string;
  target_entity: string;
  update_rule: string | null;
  delete_rule: string | null;
  is_active: boolean;
  fields: Array<{ source_field: string; target_field: string; sequence: number }>;
}
export interface SchemaEntity {
  id: string;
  connection_id: string;
  physical_name: string;
  display_name: string;
  entity_type: string;
  engine: string;
  schema_name: string;
  comment: string | null;
  estimated_rows: number | null;
  storage_engine: string | null;
  collation: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  fields: Array<{
    id: string;
    physical_name: string;
    display_name: string;
    ordinal_position: number;
    native_data_type: string;
    normalized_data_type: string;
    column_type: string;
    is_nullable: boolean;
    default_value: unknown;
    is_primary_key: boolean;
    is_unique: boolean;
    is_auto_increment: boolean;
    comment: string | null;
    is_active: boolean;
  }>;
  indexes: Array<{
    id: string;
    physical_name: string;
    index_type: string | null;
    is_unique: boolean;
    is_primary: boolean;
    is_active: boolean;
    fields: Array<{
      field_name: string | null;
      sequence: number;
      sort_direction: string | null;
      prefix_length: number | null;
    }>;
  }>;
  incoming_relationships: PhysicalRelationship[];
  outgoing_relationships: PhysicalRelationship[];
}
export interface Synchronization {
  id: string;
  connection_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  entities_discovered: number;
  fields_discovered: number;
  indexes_discovered: number;
  relationships_discovered: number;
  entities_added: number;
  entities_updated: number;
  entities_removed: number;
  fields_added: number;
  fields_updated: number;
  fields_removed: number;
  warnings: string[];
  error_code: string | null;
  error_message: string | null;
}
export interface SchemaChange {
  id: string;
  synchronization_id: string;
  change_type: "added" | "updated" | "removed" | "reactivated";
  object_type: "entity" | "field" | "index" | "relationship";
  object_id: string;
  physical_name: string;
  created_at: string;
}
