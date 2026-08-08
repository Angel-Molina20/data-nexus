import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
interface PaginationProps {
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  page: number;
  pageSize?: number;
  pageSizes?: number[];
  totalPages?: number;
}
export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize = 25,
  pageSizes = [25, 50, 100],
  totalPages,
}: PaginationProps) {
  return (
    <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-end gap-2">
      <Button
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
        size="sm"
        startIcon={<ChevronLeft className="size-4" />}
        variant="secondary"
      >
        Anterior
      </Button>
      <span aria-live="polite" className="text-xs text-muted">
        Página {page}
        {totalPages ? ` de ${String(totalPages)}` : ""}
      </span>
      {onPageSizeChange ? (
        <div className="relative">
          <select
            aria-label="Filas por página"
            className="field w-auto appearance-none pr-9"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
        </div>
      ) : null}
      <Button
        disabled={Boolean(totalPages && page >= totalPages)}
        endIcon={<ChevronRight className="size-4" />}
        onClick={() => {
          onPageChange(page + 1);
        }}
        size="sm"
        variant="secondary"
      >
        Siguiente
      </Button>
    </nav>
  );
}
