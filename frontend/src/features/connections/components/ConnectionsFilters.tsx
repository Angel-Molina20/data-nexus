import { Search } from "lucide-react";

interface ConnectionsFiltersProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function ConnectionsFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: ConnectionsFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
      <label className="field-with-icon">
        <span className="sr-only">Buscar conexiones</span>
        <Search aria-hidden="true" className="size-4" />
        <input
          value={search}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="Buscar por nombre"
        />
      </label>
      <select
        aria-label="Filtrar conexiones por estado"
        className="field"
        value={status}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <option value="">Todos los estados</option>
        <option value="connected">Conectadas</option>
        <option value="error">Con error</option>
        <option value="disconnected">Desconectadas</option>
      </select>
    </div>
  );
}
