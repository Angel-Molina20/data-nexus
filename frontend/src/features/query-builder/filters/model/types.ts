import type { QueryExpression } from "../../../queries/types";

export type FilterArea = "where" | "having";
export type FilterDataType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "json"
  | "binary"
  | "unknown";
export type FilterValueSource = "literal" | "parameter" | "field";
export type FilterCardinality = "none" | "one" | "two" | "many";

export interface FilterFieldOption {
  id: string;
  sourceId: string;
  fieldId?: string;
  label: string;
  searchText: string;
  dataType: FilterDataType;
  expression: QueryExpression;
  aggregate: boolean;
  available: boolean;
}

export interface FilterOperatorDefinition {
  id: string;
  label: string;
  nodeType: "comparison" | "is_null" | "between" | "in" | "like";
  astOperator?: string;
  negated?: boolean;
  compatibleTypes: FilterDataType[] | "all";
  cardinality: FilterCardinality;
  valueSources: FilterValueSource[];
  likeAffix?: "contains" | "starts" | "ends";
}

export interface FilterDraft {
  fieldKey: string;
  operatorId: string;
  valueSource: FilterValueSource;
  values: string[];
  parameterId: string;
  rightFieldKey: string;
}

export const emptyFilterDraft = (): FilterDraft => ({
  fieldKey: "",
  operatorId: "",
  valueSource: "literal",
  values: [""],
  parameterId: "",
  rightFieldKey: "",
});
