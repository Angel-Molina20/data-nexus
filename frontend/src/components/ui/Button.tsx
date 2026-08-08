import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  endIcon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  startIcon?: ReactNode;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-active",
  secondary: "border border-border bg-surface text-foreground-secondary hover:bg-surface-muted active:border-border-strong",
  ghost: "text-foreground-secondary hover:bg-surface-muted active:bg-slate-200",
  danger: "border border-red-200 bg-surface text-danger hover:bg-red-50 active:bg-red-100",
  link: "min-h-0 px-0 py-0 text-primary underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className, disabled, endIcon, iconOnly = false, loading = false, size = "md", startIcon, type = "button", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50", sizes[size], iconOnly && (size === "sm" ? "size-8 p-0" : size === "lg" ? "size-12 p-0" : "size-10 p-0"), variants[variant], className)}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : startIcon}
      {iconOnly ? <>{children}<span className="sr-only">{props["aria-label"]}</span></> : children}
      {!loading && !iconOnly ? endIcon : null}
    </button>
  );
});
