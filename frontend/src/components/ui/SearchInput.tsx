import { LoaderCircle, Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  loading?: boolean;
  onClear?: () => void;
}
export function SearchInput({ loading = false, onClear, value, ...props }: SearchInputProps) {
  return (
    <Input
      endIcon={
        loading || (value && onClear) ? (
          <span className="flex items-center gap-1">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {value && onClear ? (
              <IconButton label="Limpiar búsqueda" onClick={onClear} size="sm">
                <X className="size-3" />
              </IconButton>
            ) : null}
          </span>
        ) : null
      }
      startIcon={<Search className="size-4" />}
      type="search"
      value={value}
      {...props}
    />
  );
}
