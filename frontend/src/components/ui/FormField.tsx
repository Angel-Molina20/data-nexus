import { useId, type ReactNode } from "react";

import { cx } from "./utils";

export interface FieldDescription {
  describedBy?: string;
  errorId?: string;
  fieldId: string;
  helperId?: string;
}

interface FormFieldProps {
  children: (field: FieldDescription) => ReactNode;
  className?: string;
  description?: string;
  error?: string;
  helperText?: string;
  id?: string;
  label?: string;
  required?: boolean;
}

export function FormField({
  children,
  className,
  description,
  error,
  helperText,
  id,
  label,
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId.replaceAll(":", "")}`;
  const helperId = description || helperText ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("grid gap-1.5", className)}>
      {label ? (
        <label className="text-label text-foreground-secondary" htmlFor={fieldId}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {description ? (
        <p className="text-caption text-muted" id={helperId}>
          {description}
        </p>
      ) : null}
      {children({ describedBy, errorId, fieldId, helperId })}
      {!description && helperText ? (
        <p className="text-caption text-muted" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className="text-caption font-medium text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
