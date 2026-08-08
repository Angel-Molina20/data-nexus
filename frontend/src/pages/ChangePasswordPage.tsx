import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { changePassword } from "../features/auth/api/authApi";

const schema = z
  .object({
    current: z.string().min(1),
    password: z.string().min(12, "Mínimo 12 caracteres"),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden",
  });
type Data = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const form = useForm<Data>({
    resolver: zodResolver(schema),
    defaultValues: { current: "", password: "", confirmation: "" },
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: Data) => changePassword(data.current, data.password, data.confirmation),
    onSuccess: async () => {
      form.reset();
      await client.invalidateQueries({ queryKey: ["auth", "me"] });
      await navigate("/");
    },
  });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Cuenta"
        title="Cambiar contraseña"
        description="Debe tener 12 caracteres, mayúscula, minúscula, número y símbolo."
      />
      <form
        className="max-w-xl rounded-xl border border-slate-200 bg-white p-6"
        onSubmit={(event) => {
          void form.handleSubmit((data) => {
            mutation.mutate(data);
          })(event);
        }}
      >
        {(
          [
            ["current", "Contraseña actual"],
            ["password", "Nueva contraseña"],
            ["confirmation", "Confirmación"],
          ] as const
        ).map(([name, label]) => (
          <label className="mb-4 grid gap-2 text-sm font-semibold" key={name}>
            {label}
            <input
              autoComplete={name === "current" ? "current-password" : "new-password"}
              className="field"
              type="password"
              {...form.register(name)}
            />
            {form.formState.errors[name] ? (
              <span className="text-red-600">{form.formState.errors[name].message}</span>
            ) : null}
          </label>
        ))}
        {mutation.isError ? (
          <p className="alert-error">No fue posible cambiar la contraseña.</p>
        ) : null}
        <button className="btn-primary" disabled={mutation.isPending} type="submit">
          Guardar contraseña
        </button>
      </form>
    </PageContainer>
  );
}
