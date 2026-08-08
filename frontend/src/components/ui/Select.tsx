import { forwardRef, type SelectHTMLAttributes } from "react";

import { FormField } from "./FormField";
import { cx } from "./utils";

export interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  emptyText?: string;
  error?: string;
  helperText?: string;
  label?: string;
  loading?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    emptyText = "No hay opciones",
    error,
    helperText,
    id,
    label,
    loading = false,
    options,
    placeholder,
    required,
    ...props
  },
  ref,
) {
  return (
    <FormField error={error} helperText={helperText} id={id} label={label} required={required}>
      {({ describedBy, fieldId }) => (
        <select
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={cx("field", error && "border-danger", className)}
          disabled={props.disabled || loading}
          id={fieldId}
          ref={ref}
          required={required}
          {...props}
        >
          {placeholder || loading ? (
            <option value="">{loading ? "Cargando…" : placeholder}</option>
          ) : null}
          {!loading && options.length === 0 ? (
            <option disabled value="">
              {emptyText}
            </option>
          ) : null}
          {options.map((option) => (
            <option disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
});
