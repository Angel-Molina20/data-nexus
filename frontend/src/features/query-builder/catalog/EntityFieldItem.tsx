import { KeyRound, Link2, LockKeyhole } from "lucide-react";

import type { SemanticField } from "../../relationships/types";
import type { SchemaEntity } from "../../schema/types";

type Field = SchemaEntity["fields"][number];

export function EntityFieldItem({
  checked,
  disabled,
  field,
  foreignKey,
  inspected,
  onInspect,
  onToggle,
  semantic,
}: {
  checked: boolean;
  disabled: boolean;
  field: Field;
  foreignKey?: string;
  inspected: boolean;
  onInspect: () => void;
  onToggle: (checked: boolean) => void;
  semantic?: SemanticField;
}) {
  const label = semantic?.display_name || field.display_name;
  const sensitive = semantic?.is_sensitive ?? false;
  const selectable = (semantic?.is_visible ?? true) && !disabled;
  const restriction = !(semantic?.is_visible ?? true)
    ? "Campo oculto por la capa semántica"
    : sensitive && disabled
      ? "Requiere permiso para campos sensibles"
      : disabled
        ? "Añade primero la entidad mediante una relación"
        : undefined;
  return (
    <li
      className={`group flex min-h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-slate-50 ${checked ? "bg-blue-50" : ""} ${inspected ? "ring-1 ring-inset ring-blue-300" : ""}`}
    >
      <input
        aria-label={`${checked ? "Quitar" : "Seleccionar"} campo ${label}`}
        checked={checked}
        className="size-4 shrink-0 accent-primary"
        disabled={!selectable}
        onChange={(event) => {
          onToggle(event.target.checked);
        }}
        title={restriction}
        type="checkbox"
      />
      <button
        className="min-w-0 flex-1 truncate text-left font-medium text-slate-700"
        onClick={onInspect}
        title={`${label} · ${field.column_type} · Nullable: ${field.is_nullable ? "sí" : "no"}`}
        type="button"
      >
        {label}
      </button>
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-500">
        {field.is_primary_key ? (
          <span className="inline-flex items-center gap-0.5" title="Clave primaria">
            <KeyRound className="size-3" aria-hidden="true" /> PK
          </span>
        ) : null}
        {foreignKey ? (
          <span className="inline-flex items-center gap-0.5" title={`Clave foránea: ${foreignKey}`}>
            <Link2 className="size-3" aria-hidden="true" /> FK
          </span>
        ) : null}
        {sensitive ? (
          <span title="Campo sensible">
            <LockKeyhole className="size-3.5 text-amber-600" aria-label="Campo sensible" />
          </span>
        ) : null}
      </span>
    </li>
  );
}
