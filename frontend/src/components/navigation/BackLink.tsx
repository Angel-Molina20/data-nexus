import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

interface BackLinkProps {
  label: string;
  to: string;
  variant?: "button" | "breadcrumb";
}

export function BackLink({ label, to, variant = "button" }: BackLinkProps) {
  return <Link className={variant === "button" ? "btn-secondary" : "inline-flex items-center gap-1.5 font-medium text-muted transition-colors hover:text-primary"} to={to}><ArrowLeft aria-hidden="true" className="size-4" />{label}</Link>;
}
