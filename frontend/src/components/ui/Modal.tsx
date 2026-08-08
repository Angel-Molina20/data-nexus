import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { cx } from "./utils";

type ModalSize = "sm" | "md" | "lg" | "xl";
interface ModalProps { children: ReactNode; description?: string; footer?: ReactNode; loading?: boolean; onClose: () => void; open: boolean; size?: ModalSize; title: string; }
const sizes: Record<ModalSize, string> = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ children, description, footer, loading = false, onClose, open, size = "md", title }: ModalProps) {
  const titleId = useId(); const descriptionId = useId(); const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; const panel = panelRef.current; panel?.querySelector<HTMLElement>(focusable)?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !loading) onClose(); if (event.key !== "Tab" || !panel) return; const items = [...panel.querySelectorAll<HTMLElement>(focusable)]; if (!items.length) { event.preventDefault(); return; } const first = items[0]; const last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }; document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); }; }, [loading, onClose, open]);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[var(--z-modal,50)] grid place-items-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}><div aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className={cx("my-auto w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg", sizes[size])} ref={panelRef} role="dialog"><header className="flex items-start gap-4 border-b border-border px-5 py-4"><div className="min-w-0 flex-1"><h2 className="text-heading-3" id={titleId}>{title}</h2>{description ? <p className="text-body-small mt-1 text-muted" id={descriptionId}>{description}</p> : null}</div><IconButton disabled={loading} label="Cerrar diálogo" onClick={onClose} size="sm"><X className="size-4" /></IconButton></header><div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>{footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted px-5 py-4">{footer}</footer> : null}</div></div>, document.body);
}
