interface ReportsFiltersProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}
export function ReportsFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: ReportsFiltersProps) {
  return (
    <div className="flex gap-3 rounded-xl border bg-white p-3">
      <input
        aria-label="Buscar reportes"
        className="field max-w-sm"
        placeholder="Buscar reportes…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <select
        aria-label="Filtrar estado"
        className="field max-w-48"
        value={status}
        onChange={(event) => {
          onStatusChange(event.target.value);
        }}
      >
        <option value="">Activos</option>
        <option value="draft">Borradores</option>
        <option value="published">Publicados</option>
        <option value="archived">Archivados</option>
      </select>
    </div>
  );
}
