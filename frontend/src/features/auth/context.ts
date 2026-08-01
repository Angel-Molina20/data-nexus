import { createContext, useContext } from "react";
import type { AuthUser } from "./types";

export interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider no disponible");
  return value;
}
