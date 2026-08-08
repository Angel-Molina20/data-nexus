import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { cx } from "./utils";
interface DrawerProps {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg";
  title: string;
}
export function Drawer({
  children,
  footer,
  onClose,
  open,
  position = "right",
  size = "md",
  title,
}: DrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose, open]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-drawer,40)] bg-slate-950/50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className={cx(
          "absolute inset-y-0 flex w-full flex-col bg-surface shadow-lg",
          position === "right" ? "right-0" : "left-0",
          size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
        role="dialog"
      >
        <header className="flex min-h-14 items-center border-b border-border px-4">
          <h2 className="mr-auto font-semibold" id={titleId}>
            {title}
          </h2>
          <IconButton label="Cerrar panel" onClick={onClose} ref={closeRef}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-border p-4">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
