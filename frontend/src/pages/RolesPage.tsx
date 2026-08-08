import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import type { Permission } from "../features/auth/types";
import { assignRolePermissions, listPermissions, listRoles } from "../features/auth/api/authApi";

export function RolesPage() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const permissions = useQuery({ queryKey: ["permissions"], queryFn: listPermissions });
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const selectedRole = roles.data?.find((role) => role.id === selectedRoleId);
  useEffect(() => {
    if (!selectedRoleId && roles.data?.[0]) setSelectedRoleId(roles.data[0].id);
  }, [roles.data, selectedRoleId]);
  useEffect(() => {
    setSelectedCodes(selectedRole?.permissions ?? []);
  }, [selectedRole]);
  const save = useMutation({
    mutationFn: () =>
      assignRolePermissions(
        selectedRoleId,
        (permissions.data ?? [])
          .filter((item) => selectedCodes.includes(item.code))
          .map((item) => item.id),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
  const grouped = (permissions.data ?? []).reduce<Record<string, Permission[]>>((result, item) => {
    (result[item.resource_type] ??= []).push(item);
    return result;
  }, {});
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Autorización"
        title="Roles y permisos"
        description="Los permisos se agrupan por recurso y se guardan explícitamente."
      />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border bg-white p-4">
          {roles.data?.map((role) => (
            <button
              type="button"
              className={`block w-full border-b p-3 text-left ${selectedRoleId === role.id ? "bg-blue-50" : ""}`}
              key={role.id}
              onClick={() => {
                setSelectedRoleId(role.id);
              }}
            >
              <strong>{role.name}</strong>
              <span className="block text-xs text-slate-500">
                {role.code} · {role.permissions.length} permisos{role.is_system ? " · Sistema" : ""}
              </span>
            </button>
          ))}
        </section>
        <section className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Matriz de permisos</h2>
              <p className="text-sm text-slate-500">{selectedRole?.name ?? "Selecciona un rol"}</p>
            </div>
            <button
              className="btn-primary"
              disabled={!selectedRole || save.isPending}
              onClick={() => {
                save.mutate();
              }}
            >
              {save.isPending ? "Guardando…" : "Guardar permisos"}
            </button>
          </div>
          {save.isSuccess ? <p className="alert-success mt-4">Permisos actualizados.</p> : null}
          {save.isError ? (
            <p className="alert-error mt-4">No fue posible guardar los permisos.</p>
          ) : null}
          {Object.entries(grouped).map(([resource, items]) => (
            <div className="mt-5" key={resource}>
              <h3 className="text-sm font-bold uppercase text-slate-500">{resource}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <label className="rounded-lg border p-3 text-sm" key={item.id}>
                    <input
                      className="mr-2"
                      checked={selectedCodes.includes(item.code)}
                      disabled={!selectedRole}
                      type="checkbox"
                      onChange={(event) => {
                        setSelectedCodes((current) =>
                          event.target.checked
                            ? [...current, item.code]
                            : current.filter((code) => code !== item.code),
                        );
                      }}
                    />
                    {item.name}
                    <span className="block pl-6 text-xs text-slate-400">{item.code}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
