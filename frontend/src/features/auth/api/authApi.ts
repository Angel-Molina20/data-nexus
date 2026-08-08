import type { AuthUser, ManagedUser, Permission, Role } from "../types";
import { apiRequest, clearCsrfToken } from "../../../shared/api/httpClient";

export const login = (email: string, password: string) =>
  apiRequest<AuthUser>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { csrf: false },
  );
export const currentUser = () => apiRequest<AuthUser>("/auth/me");
export const logout = async () => {
  await apiRequest<undefined>("/auth/logout", { method: "POST" });
  clearCsrfToken();
};
export const changePassword = (current: string, password: string, confirmation: string) =>
  apiRequest<undefined>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: current,
      new_password: password,
      confirm_password: confirmation,
    }),
  });
export const listUsers = () => apiRequest<ManagedUser[]>("/users");
export const createUser = (payload: Record<string, unknown>) =>
  apiRequest<ManagedUser>("/users", { method: "POST", body: JSON.stringify(payload) });
export const updateUser = (id: string, payload: Record<string, unknown>) =>
  apiRequest<ManagedUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const userAction = (id: string, action: string, payload?: Record<string, unknown>) =>
  apiRequest<ManagedUser | undefined>(`/users/${id}/${action}`, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
export const assignUserRoles = (id: string, ids: string[]) =>
  apiRequest<ManagedUser>(`/users/${id}/roles`, { method: "PUT", body: JSON.stringify({ ids }) });
export const listRoles = () => apiRequest<Role[]>("/roles");
export const listPermissions = () => apiRequest<Permission[]>("/permissions");
export const assignRolePermissions = (id: string, ids: string[]) =>
  apiRequest<Role>(`/roles/${id}/permissions`, { method: "PUT", body: JSON.stringify({ ids }) });
export interface ConnectionAccess {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  access_level: string;
}
export const listConnectionAccess = (id: string) =>
  apiRequest<ConnectionAccess[]>(`/connections/${id}/access`);
export const grantConnectionAccess = (connectionId: string, userId: string, access_level: string) =>
  apiRequest<ConnectionAccess>(`/connections/${connectionId}/access/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ access_level }),
  });
export const revokeConnectionAccess = (connectionId: string, userId: string) =>
  apiRequest<undefined>(`/connections/${connectionId}/access/${userId}`, { method: "DELETE" });
