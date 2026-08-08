import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Network } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useLogin } from "../hooks/useLogin";
import { loginSchema, type LoginFormData } from "../schemas/loginSchema";
import { PasswordField } from "./PasswordField";

const errorMessages = {
  credentials: {
    title: "No pudimos iniciar sesión",
    description: "Revisa el correo y la contraseña e intenta nuevamente.",
  },
  network: {
    title: "DataNexus no está disponible",
    description: "No fue posible conectar con el servicio. Intenta nuevamente en unos momentos.",
  },
  unexpected: {
    title: "Ocurrió un problema inesperado",
    description: "No fue posible completar el inicio de sesión. Intenta nuevamente.",
  },
} as const;

export function LoginForm() {
  const login = useLogin();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    shouldFocusError: true,
  });
  const authenticationError = login.errorKind ? errorMessages[login.errorKind] : null;

  return (
    <Card className="auth-login-card w-full max-w-[29rem]" aria-labelledby="login-title">
      <CardContent className="p-6 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-white">
            <Network aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-bold text-foreground">DataNexus</p>
            <p className="text-caption text-muted">Plataforma universal de datos</p>
          </div>
        </div>

        <p className="text-caption font-semibold uppercase tracking-[0.16em] text-primary">
          Acceso seguro
        </p>
        <h2 className="text-heading-1 mt-3" id="login-title">
          Inicia sesión
        </h2>
        <p className="text-body-small mt-2 text-muted">
          Accede a tu espacio de trabajo para continuar.
        </p>

        <form
          className="mt-8 grid gap-5"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(login.submit)(event);
          }}
        >
          <Input
            autoComplete="username"
            disabled={login.isPending}
            error={form.formState.errors.email?.message}
            label="Correo"
            placeholder="nombre@empresa.com"
            required
            startIcon={<Mail className="size-4" />}
            type="email"
            {...form.register("email", { onChange: login.resetError })}
          />

          <PasswordField
            disabled={login.isPending}
            error={form.formState.errors.password?.message}
            {...form.register("password", { onChange: login.resetError })}
          />

          {authenticationError ? (
            <Alert
              description={authenticationError.description}
              title={authenticationError.title}
              variant="error"
            />
          ) : null}

          <Button className="mt-1 w-full" loading={login.isPending} size="lg" type="submit">
            {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>

        <p className="text-caption mt-6 text-center text-muted">
          El acceso es administrado por tu organización.
        </p>
      </CardContent>
    </Card>
  );
}
