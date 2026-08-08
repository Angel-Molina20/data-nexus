import { ChevronDown } from "lucide-react";
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cx } from "./utils";

interface PanelProps extends HTMLAttributes<HTMLElement> { actions?: ReactNode; collapsible?: boolean; defaultCollapsed?: boolean; footer?: ReactNode; title: string; }
export function Panel({ actions, children, className, collapsible = false, defaultCollapsed = false, footer, title, ...props }: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return <section className={cx("flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface", className)} {...props}><header className="flex min-h-11 items-center gap-2 border-b border-border px-3"><h2 className="mr-auto text-sm font-semibold">{title}</h2>{actions}{collapsible ? <IconButton label={collapsed ? "Expandir panel" : "Contraer panel"} onClick={() => { setCollapsed((value) => !value); }} size="sm"><ChevronDown className={cx("size-4 transition-transform", collapsed && "-rotate-90")} /></IconButton> : null}</header>{!collapsed ? <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div> : null}{!collapsed && footer ? <footer className="border-t border-border p-3">{footer}</footer> : null}</section>;
}
