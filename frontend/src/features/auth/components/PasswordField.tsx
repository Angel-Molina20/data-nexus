import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { IconButton } from "../../../components/ui/IconButton";
import { Input } from "../../../components/ui/Input";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ error, ...props }, ref) {
    const [isVisible, setIsVisible] = useState(false);
    const toggleLabel = isVisible ? "Ocultar contraseña" : "Mostrar contraseña";

    return (
      <Input
        autoComplete="current-password"
        endIcon={
          <IconButton
            aria-pressed={isVisible}
            label={toggleLabel}
            onClick={() => {
              setIsVisible((current) => !current);
            }}
            size="sm"
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </IconButton>
        }
        error={error}
        label="Contraseña"
        name="password"
        placeholder="Ingresa tu contraseña"
        ref={ref}
        required
        startIcon={<LockKeyhole className="size-4" />}
        type={isVisible ? "text" : "password"}
        {...props}
      />
    );
  },
);
