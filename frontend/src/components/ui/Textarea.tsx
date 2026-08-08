import { forwardRef, type TextareaHTMLAttributes } from "react";
import { FormField } from "./FormField";
import { cx } from "./utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { error?: string; helperText?: string; label?: string; }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, error, helperText, id, label, required, ...props }, ref) {
  return <FormField error={error} helperText={helperText} id={id} label={label} required={required}>{({ describedBy, fieldId }) => <textarea aria-describedby={describedBy} aria-invalid={Boolean(error)} className={cx("field min-h-24 resize-y", error && "border-danger", className)} id={fieldId} ref={ref} required={required} {...props} />}</FormField>;
});
