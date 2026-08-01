import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AuthContext } from "./context";
import { currentUser, logout as logoutRequest } from "../../services/auth";
import { setUnauthorizedHandler } from "../../services/shared";

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser, retry: false });
  useEffect(() => {
    setUnauthorizedHandler(() => { client.setQueryData(["auth", "me"], null); });
    return () => { setUnauthorizedHandler(null); };
  }, [client]);
  const logout = async () => { await logoutRequest(); client.clear(); };
  const user = query.data ?? null;
  return <AuthContext.Provider value={{ user, loading: query.isPending, logout, hasPermission: (code) => Boolean(user?.permissions.includes(code)) }}>{children}</AuthContext.Provider>;
}
