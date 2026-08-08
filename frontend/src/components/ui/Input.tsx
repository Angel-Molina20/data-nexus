import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { FormField } from "./FormField";
import { cx } from "./utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  endIcon?: ReactNode;
  error?: string;
  helperText?: string;
  label?: string;
  startIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, endIcon, error, helperText, id, label, required, startIcon, ...props }, ref,
) {
  return <FormField error={error} helperText={helperText} id={id} label={label} required={required}>{({ describedBy, fieldId }) => (
    <div className={cx("flex min-h-10 items-center gap-2 rounded-md border bg-surface px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100", error ? "border-danger" : "border-border hover:border-border-strong", props.disabled && "bg-surface-muted text-disabled", className)}>
      {startIcon ? <span aria-hidden="true" className="shrink-0 text-muted">{startIcon}</span> : null}
      <input aria-describedby={describedBy} aria-invalid={Boolean(error)} className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed" id={fieldId} ref={ref} required={required} {...props} />
      {endIcon ? <span className="shrink-0 text-muted">{endIcon}</span> : null}
    </div>
  )}</FormField>;
});
