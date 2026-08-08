import type { ReactNode } from "react";
import { cx } from "../ui/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: "centered" | "full";
  spacing?: "compact" | "default";
}

export function PageContainer({ children, className, size = "full", spacing = "default" }: PageContainerProps) {
  return <div className={cx("mx-auto w-full", size === "centered" ? "max-w-5xl" : "max-w-[1600px]", spacing === "compact" ? "space-y-4" : "space-y-6", className)}>{children}</div>;
}
