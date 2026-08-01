import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, LockOpen, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { createUser, listRoles, listUsers, userAction } from "../services/auth";

const schema = z.object({
  email: z.email("Ingresa un correo válido."),
  full_name: z.string().min(1, "Ingresa el nombre."),
  password: z.string().min(12, "Usa al menos 12 caracteres."),
  role_ids: z.array(z.string()),
  must_change_password: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function UsersPage() {
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", full_name: "", password: "", role_ids: [], must_change_password: true },
  });
  const create = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      form.reset();
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => userAction(id, name),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["users"] }); },
  });

  return <PageContainer>
    <PageHeader eyebrow="Administración" title="Usuarios" description="Gestiona cuentas, roles, bloqueos y sesiones." actions={<button className="btn-primary" onClick={() => { setCreating((value) => !value); }}>{creating ? "Cancelar" : "Crear usuario"}</button>} />
    {creating ? <form className="mb-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-12 md:p-6" onSubmit={(event) => { void form.handleSubmit((values) => { create.mutate(values); })(event); }}>
      <div className="md:col-span-12"><h2 className="text-lg font-semibold text-slate-900">Nueva cuenta</h2><p className="mt-1 text-sm text-slate-500">Completa los datos y asigna al menos el acceso que corresponda.</p></div>
      <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-6">Nombre completo<input className="field" autoComplete="name" placeholder="Ej. María González" {...form.register("full_name")} />{form.formState.errors.full_name ? <span className="text-xs font-medium text-red-600">{form.formState.errors.full_name.message}</span> : null}</label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-6">Correo electrónico<input className="field" autoComplete="username" placeholder="usuario@empresa.com" type="email" {...form.register("email")} />{form.formState.errors.email ? <span className="text-xs font-medium text-red-600">{form.formState.errors.email.message}</span> : null}</label>
      <label className="grid gap-2 self-start text-sm font-semibold text-slate-700 md:col-span-5">Contraseña temporal<input className="field" autoComplete="new-password" placeholder="Mínimo 12 caracteres" type="password" {...form.register("password")} />{form.formState.errors.password ? <span className="text-xs font-medium text-red-600">{form.formState.errors.password.message}</span> : <span className="text-xs font-normal text-slate-500">Debe incluir mayúscula, minúscula, número y carácter especial.</span>}</label>
      <fieldset className="min-w-0 md:col-span-7"><legend className="mb-2 text-sm font-semibold text-slate-700">Roles</legend><div className="grid gap-2 sm:grid-cols-3">{roles.data?.map((role) => <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50" key={role.id}><input className="size-4 accent-blue-600" type="checkbox" value={role.id} {...form.register("role_ids")} />{role.name}</label>)}</div></fieldset>
      <div className="mt-3 flex flex-col gap-5 border-t border-slate-200 pt-6 md:col-span-12 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 text-sm text-slate-700"><input className="size-4 accent-blue-600" type="checkbox" {...form.register("must_change_password")} />Exigir cambio de contraseña en el primer inicio</label><button className="btn-primary min-w-32 justify-center" disabled={create.isPending} type="submit">{create.isPending ? "Creando…" : "Crear cuenta"}</button></div>
      {create.isError ? <p className="alert-error md:col-span-12">No fue posible crear el usuario.</p> : null}
    </form> : null}
    {users.isPending ? <p className="state-message">Cargando usuarios…</p> : users.isError ? <p className="alert-error">No fue posible cargar usuarios.</p> : <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[820px] table-fixed text-left text-sm"><colgroup><col className="w-[30%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[24%]" /><col className="w-[15%]" /></colgroup><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Usuario</th><th className="px-5 py-4">Roles</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Último acceso</th><th className="px-5 py-4 text-center">Acciones</th></tr></thead><tbody>{users.data.map((user) => <tr className="border-t border-slate-100 transition hover:bg-slate-50/70" key={user.id}><td className="px-5 py-4"><strong className="text-slate-900">{user.full_name}</strong><p className="mt-0.5 truncate text-slate-500" title={user.email}>{user.email}</p></td><td className="px-5 py-4 text-slate-600">{user.roles.join(", ") || "Sin rol"}</td><td className="px-5 py-4"><StatusBadge variant={user.status === "active" ? "success" : "warning"}>{user.status}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Nunca"}</td><td className="px-5 py-4"><div className="flex items-center justify-center gap-2"><button aria-label={user.status === "active" ? `Desactivar a ${user.full_name}` : `Activar a ${user.full_name}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" title={user.status === "active" ? "Desactivar usuario" : "Activar usuario"} onClick={() => { action.mutate({ id: user.id, name: user.status === "active" ? "disable" : "activate" }); }}>{user.status === "active" ? <UserX className="size-4" /> : <UserCheck className="size-4" />}</button>{user.status === "locked" ? <button aria-label={`Desbloquear a ${user.full_name}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" title="Desbloquear usuario" onClick={() => { action.mutate({ id: user.id, name: "unlock" }); }}><LockOpen className="size-4" /></button> : null}<button aria-label={`Revocar sesiones de ${user.full_name}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" title="Revocar sesiones" onClick={() => { action.mutate({ id: user.id, name: "revoke-sessions" }); }}><LogOut className="size-4" /></button></div></td></tr>)}</tbody></table></section>}
  </PageContainer>;
}
