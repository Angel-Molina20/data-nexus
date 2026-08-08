import type { ReactNode } from "react";
interface FormSectionProps { children: ReactNode; description?: string; title: string; }
export function FormSection({ children, description, title }: FormSectionProps) { return <fieldset className="grid gap-5"><legend className="w-full border-b border-border pb-3"><span className="text-heading-3 block">{title}</span>{description ? <span className="text-body-small mt-1 block text-muted">{description}</span> : null}</legend>{children}</fieldset>; }
