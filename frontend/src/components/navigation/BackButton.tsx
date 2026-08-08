import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { useReturnNavigation } from "../../shared/hooks/useReturnNavigation";

export interface BackButtonProps {
  fallback: string;
  label: string;
  onBack?: () => void;
}

export function BackButton({ fallback, label, onBack }: BackButtonProps) {
  const { returnTo } = useReturnNavigation(fallback);
  const className =
    "inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground-secondary transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2";
  const content = (
    <>
      <ArrowLeft aria-hidden="true" className="size-4" />
      <span className="truncate">{label}</span>
    </>
  );

  return onBack ? (
    <button aria-label={label} className={className} onClick={onBack} type="button">
      {content}
    </button>
  ) : (
    <Link aria-label={label} className={className} to={returnTo}>
      {content}
    </Link>
  );
}
