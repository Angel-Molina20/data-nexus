import { useMemo, useState } from "react";

import { SearchInput } from "../../../../components/ui/SearchInput";
import type { FilterFieldOption } from "../model/types";

export function FilterFieldSelector({
  fields,
  value,
  onChange,
  disabled,
  label = "Campo",
}: {
  fields: FilterFieldOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return fields.filter((field) => !term || field.searchText.includes(term));
  }, [fields, search]);
  return (
    <div className="min-w-52 flex-1">
      <span className="sr-only">{label}</span>
      <SearchInput
        aria-label={`Buscar ${label.toLocaleLowerCase()}`}
        className="mb-1 min-h-8"
        disabled={disabled}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        onClear={() => {
          setSearch("");
        }}
        placeholder="Buscar entidad, alias o campo…"
        value={search}
      />
      <select
        aria-label={label}
        className="field min-h-9 py-1.5 text-sm"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      >
        <option value="">Selecciona un campo…</option>
        {visible.map((field) => (
          <option disabled={!field.available} key={field.id} value={field.id}>
            {field.label}
            {field.available ? "" : " (no disponible)"}
          </option>
        ))}
      </select>
    </div>
  );
}
