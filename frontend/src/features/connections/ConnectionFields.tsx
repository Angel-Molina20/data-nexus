import type { UseFormRegister, FieldErrors } from "react-hook-form";

import type { ConnectionFormData } from "./types";

interface Props {
  register: UseFormRegister<ConnectionFormData>;
  errors: FieldErrors<ConnectionFormData>;
  passwordOptional?: boolean;
}

export function ConnectionFields({ register, errors, passwordOptional = false }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Nombre" error={errors.name?.message}>
        <input className="field" {...register("name")} />
      </Field>
      <Field label="Host" error={errors.host?.message}>
        <input className="field" autoComplete="off" {...register("host")} />
      </Field>
      <Field label="Puerto" error={errors.port?.message}>
        <input className="field" type="number" {...register("port", { valueAsNumber: true })} />
      </Field>
      <Field label="Base de datos" error={errors.database_name?.message}>
        <input className="field" {...register("database_name")} />
      </Field>
      <Field label="Usuario" error={errors.username?.message}>
        <input className="field" autoComplete="username" {...register("username")} />
      </Field>
      <Field
        label={passwordOptional ? "Nueva contraseña (opcional)" : "Contraseña"}
        error={errors.password?.message}
      >
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {passwordOptional ? (
          <small>Deja este campo vacío para conservar la contraseña actual.</small>
        ) : null}
      </Field>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input className="size-4" type="checkbox" {...register("ssl_enabled")} /> Usar SSL
      </label>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
