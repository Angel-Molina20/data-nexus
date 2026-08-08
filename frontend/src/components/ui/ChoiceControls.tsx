import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./utils";

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> { description?: string; error?: string; label: string; }
function Choice({ className, description, error, id, label, type, ...props }: ChoiceProps & { type: "checkbox" | "radio" }) {
  const generated = useId(); const fieldId = id ?? `choice-${generated.replaceAll(":", "")}`; const helpId = description ? `${fieldId}-help` : undefined;
  return <div><label className={cx("flex min-h-10 items-start gap-3 text-sm text-foreground-secondary", props.disabled && "text-disabled", className)} htmlFor={fieldId}><input aria-describedby={helpId} aria-invalid={Boolean(error)} className="mt-1 size-4 accent-primary" id={fieldId} type={type} {...props} /><span><span className="font-medium">{label}</span>{description ? <span className="mt-0.5 block text-xs text-muted" id={helpId}>{description}</span> : null}</span></label>{error ? <p className="text-caption text-danger" role="alert">{error}</p> : null}</div>;
}
export function Checkbox(props: ChoiceProps) { return <Choice type="checkbox" {...props} />; }
export function Radio(props: ChoiceProps) { return <Choice type="radio" {...props} />; }

interface SwitchProps { checked: boolean; className?: string; description?: string; disabled?: boolean; label: string; name?: string; onChange: (checked: boolean) => void; }
export function Switch({ checked, className, description, disabled, label, name, onChange }: SwitchProps) {
  return <div className={cx("flex min-h-10 items-center justify-between gap-4", disabled && "text-disabled", className)}><span><span className="text-sm font-medium">{label}</span>{description ? <span className="block text-xs text-muted">{description}</span> : null}</span><button aria-checked={checked} aria-label={label} className={cx("relative h-6 w-11 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-border-strong bg-surface-muted")} disabled={disabled} name={name} onClick={() => { onChange(!checked); }} role="switch" type="button"><span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} /><span className="sr-only">{checked ? "Activado" : "Desactivado"}</span></button></div>;
}
