import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { useAuth } from "../features/auth/context";
import { login } from "../features/auth/api/authApi";

const schema = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const auth = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: FormData) => login(data.email, data.password),
    onSuccess: async (user) => {
      client.setQueryData(["auth", "me"], user);
      form.reset();
      await navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    },
  });
  if (auth.user) {
    return (
      <Navigate replace to={auth.user.must_change_password ? "/account/change-password" : "/"} />
    );
  }
  return (
    <main className="grid min-h-screen bg-slate-100 lg:grid-cols-2">
      <section className="hidden bg-[#071a34] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-bold">
          <span className="grid size-11 place-items-center rounded-xl bg-blue-600">
            <DatabaseZap />
          </span>
          DataNexus
        </div>
        <div>
          <h1 className="max-w-lg text-4xl font-bold">Universal Data Reporting Platform</h1>
          <p className="mt-4 max-w-lg text-slate-300">
            Acceso seguro a conexiones, esquemas y catálogo semántico.
          </p>
        </div>
        <p className="text-sm text-slate-400">Sesión protegida mediante cookie HttpOnly.</p>
      </section>
      <section className="grid place-items-center p-5">
        <form
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          onSubmit={(event) => {
            void form.handleSubmit((data) => {
              mutation.mutate(data);
            })(event);
          }}
        >
          <div className="mb-8 lg:hidden">
            <strong className="text-xl">DataNexus</strong>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Acceso seguro</p>
          <h2 className="mt-2 text-3xl font-bold">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-slate-500">Ingresa tus credenciales de DataNexus.</p>
          <label className="mt-7 grid gap-2 text-sm font-semibold">
            Correo
            <input
              autoComplete="username"
              className="field"
              type="email"
              {...form.register("email")}
            />
          </label>
          {form.formState.errors.email ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
          ) : null}
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Contraseña
            <span className="relative">
              <input
                autoComplete="current-password"
                className="field w-full pr-12"
                type={visible ? "text" : "password"}
                {...form.register("password")}
              />
              <button
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-2 p-1 text-slate-500"
                onClick={() => {
                  setVisible((value) => !value);
                }}
                type="button"
              >
                {visible ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          {mutation.isError ? (
            <p className="alert-error mt-5">Las credenciales ingresadas no son válidas.</p>
          ) : null}
          <button
            className="btn-primary mt-6 w-full justify-center"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? "Iniciando…" : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
