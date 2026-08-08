import type { HTMLAttributes } from "react";
import { cx } from "./utils";

type CardVariant = "default" | "interactive" | "muted" | "outlined";
export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: CardVariant }) {
  const { variant = "default", ...rest } = props;
  const variants: Record<CardVariant, string> = {
    default: "bg-surface shadow-sm",
    interactive: "bg-surface shadow-sm transition hover:border-blue-200 hover:shadow-md",
    muted: "bg-surface-muted",
    outlined: "bg-transparent",
  };
  return (
    <article
      className={cx("rounded-lg border border-border", variants[variant], className)}
      {...rest}
    />
  );
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("border-b border-border px-5 py-4", className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("p-5", className)} {...props} />;
}
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "flex items-center justify-end gap-2 border-t border-border px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}
