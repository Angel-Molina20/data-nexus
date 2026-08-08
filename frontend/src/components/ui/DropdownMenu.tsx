import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cx } from "./utils";

export interface DropdownMenuItem {
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
}
interface DropdownMenuProps {
  items: DropdownMenuItem[];
  label?: string;
}
export function DropdownMenu({ items, label = "Abrir menú de acciones" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="relative inline-flex" ref={root}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        label={label}
        onClick={() => {
          setOpen((value) => !value);
        }}
        variant="secondary"
      >
        <MoreHorizontal className="size-5" strokeWidth={2.25} />
      </IconButton>
      {open ? (
        <div
          className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 min-w-44 rounded-md border border-border bg-surface p-1 shadow-md"
          role="menu"
        >
          {items.map((item) => (
            <button
              className={cx(
                "flex min-h-9 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50",
                item.danger ? "text-danger" : "text-foreground-secondary",
              )}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
