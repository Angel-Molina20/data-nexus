import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "./Button";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ children, label, size = "md", title = label, variant = "ghost", ...props }, ref) {
  return <Button aria-label={label} iconOnly ref={ref} size={size} title={title} variant={variant} {...props}>{children}</Button>;
});
