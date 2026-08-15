export const SELECT_FUNCTIONS = [
  { id: "concat", label: "CONCAT", minimum: 2, maximum: 20 },
  { id: "group_concat", label: "GROUP_CONCAT", minimum: 1, maximum: 1 },
  { id: "coalesce", label: "COALESCE", minimum: 2, maximum: 20 },
  { id: "lower", label: "LOWER", minimum: 1, maximum: 1 },
  { id: "upper", label: "UPPER", minimum: 1, maximum: 1 },
  { id: "trim", label: "TRIM", minimum: 1, maximum: 1 },
  { id: "length", label: "LENGTH", minimum: 1, maximum: 1 },
  { id: "replace", label: "REPLACE", minimum: 3, maximum: 3 },
  { id: "null_if", label: "NULLIF", minimum: 2, maximum: 2 },
  { id: "year", label: "YEAR", minimum: 1, maximum: 1 },
  { id: "month", label: "MONTH", minimum: 1, maximum: 1 },
  { id: "day", label: "DAY", minimum: 1, maximum: 1 },
  { id: "absolute", label: "ABS", minimum: 1, maximum: 1 },
  { id: "round", label: "ROUND", minimum: 1, maximum: 2 },
  { id: "floor", label: "FLOOR", minimum: 1, maximum: 1 },
  { id: "ceiling", label: "CEILING", minimum: 1, maximum: 1 },
  { id: "power", label: "POWER", minimum: 2, maximum: 2 },
] as const;

export type SelectFunctionId = (typeof SELECT_FUNCTIONS)[number]["id"];
