import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils";
interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  center?: ReactNode;
  end?: ReactNode;
  start?: ReactNode;
}
export function Toolbar({ center, className, end, start, ...props }: ToolbarProps) {
  return (
    <div
      className={cx(
        "flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2",
        className,
      )}
      role="toolbar"
      {...props}
    >
      <div className="flex items-center gap-2">{start}</div>
      {center ? (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">{center}</div>
      ) : (
        <span className="flex-1" />
      )}
      <div className="flex items-center gap-2">{end}</div>
    </div>
  );
}
