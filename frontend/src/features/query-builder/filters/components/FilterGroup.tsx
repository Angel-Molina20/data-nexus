import { Plus, Trash2 } from "lucide-react";

import { Button } from "../../../../components/ui/Button";
import type { QueryExpression, QueryParameter } from "../../../queries/types";
import type { FilterFieldOption } from "../model/types";
import type { PredicatePath } from "../model/predicates";
import { FilterCondition } from "./FilterCondition";

export function FilterGroup({
  node,
  path,
  fields,
  parameters,
  readOnly,
  root = false,
  onAdd,
  onChangeOperator,
  onReplace,
  onDuplicate,
  onDelete,
  onMove,
  onRequestDeleteGroup,
  focusPath,
  connectionId,
  scopeId,
  onAddSubquery,
}: {
  node: QueryExpression;
  path: PredicatePath;
  fields: FilterFieldOption[];
  parameters: QueryParameter[];
  readOnly: boolean;
  root?: boolean;
  onAdd: (path: PredicatePath, group: boolean) => void;
  onChangeOperator: (path: PredicatePath, operator: "and" | "or") => void;
  onReplace: (path: PredicatePath, node: QueryExpression) => void;
  onDuplicate: (path: PredicatePath) => void;
  onDelete: (path: PredicatePath) => void;
  onMove: (path: PredicatePath, direction: -1 | 1) => void;
  onRequestDeleteGroup: (path: PredicatePath, node: QueryExpression) => void;
  focusPath?: PredicatePath | null;
  connectionId: string;
  scopeId: string;
  onAddSubquery: (path: PredicatePath) => void;
}) {
  const isGroup = node.node_type === "logical_group" && Array.isArray(node.conditions);
  const conditions = isGroup ? (node.conditions as QueryExpression[]) : [node];
  const operator = isGroup && node.operator === "or" ? "or" : "and";
  return (
    <section
      className={
        root
          ? "space-y-2"
          : "ml-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 before:absolute"
      }
      data-filter-group={path.join(".") || "root"}
    >
      <header className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-semibold text-slate-600">
          {operator === "and"
            ? "Todas las condiciones (AND)"
            : "Cualquiera de las condiciones (OR)"}
        </p>
        <select
          aria-label="Operador lógico del grupo"
          className="field min-h-8 w-auto py-1 text-xs"
          disabled={readOnly || (!isGroup && conditions.length < 2)}
          onChange={(event) => {
            onChangeOperator(path, event.target.value as "and" | "or");
          }}
          value={operator}
        >
          <option value="and">Y · AND</option>
          <option value="or">O · OR</option>
        </select>
        {!root && !readOnly ? (
          <Button
            onClick={() => {
              onRequestDeleteGroup(path, node);
            }}
            size="sm"
            startIcon={<Trash2 className="size-3.5" />}
            variant="ghost"
          >
            Eliminar grupo
          </Button>
        ) : null}
      </header>
      <div className="space-y-2">
        {conditions.map((condition, index) => {
          const childPath = isGroup ? [...path, index] : path;
          return (
            <div key={childPath.join(".") || "condition-root"}>
              {index > 0 ? (
                <div className="my-1 flex items-center gap-2 text-[11px] font-bold text-blue-700">
                  <span className="h-px flex-1 bg-blue-100" />
                  {operator === "and" ? "Y" : "O"}
                  <span className="h-px flex-1 bg-blue-100" />
                </div>
              ) : null}
              {condition.node_type === "logical_group" ? (
                <FilterGroup
                  connectionId={connectionId}
                  fields={fields}
                  focusPath={focusPath}
                  node={condition}
                  onAdd={onAdd}
                  onAddSubquery={onAddSubquery}
                  onChangeOperator={onChangeOperator}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onMove={onMove}
                  onReplace={onReplace}
                  onRequestDeleteGroup={onRequestDeleteGroup}
                  parameters={parameters}
                  path={childPath}
                  readOnly={readOnly}
                  scopeId={scopeId}
                />
              ) : (
                <FilterCondition
                  canMoveDown={isGroup && index < conditions.length - 1}
                  canMoveUp={isGroup && index > 0}
                  connectionId={connectionId}
                  fields={fields}
                  focused={Boolean(focusPath && samePath(focusPath, childPath))}
                  node={condition}
                  onDelete={() => {
                    onDelete(childPath);
                  }}
                  onDuplicate={() => {
                    onDuplicate(childPath);
                  }}
                  onMove={(direction) => {
                    onMove(childPath, direction);
                  }}
                  onReplace={(next) => {
                    onReplace(childPath, next);
                  }}
                  parameters={parameters}
                  readOnly={readOnly}
                  scopeId={scopeId}
                />
              )}
            </div>
          );
        })}
      </div>
      {!readOnly ? (
        <footer className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={() => {
              onAdd(path, false);
            }}
            size="sm"
            startIcon={<Plus className="size-3.5" />}
            variant="secondary"
          >
            Condición
          </Button>
          <Button
            onClick={() => {
              onAdd(path, true);
            }}
            size="sm"
            startIcon={<Plus className="size-3.5" />}
            variant="ghost"
          >
            Grupo
          </Button>
          <Button
            onClick={() => {
              onAddSubquery(path);
            }}
            size="sm"
            variant="ghost"
          >
            Subconsulta
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

const samePath = (left: PredicatePath, right: PredicatePath) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
