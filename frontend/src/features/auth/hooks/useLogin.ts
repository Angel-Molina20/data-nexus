import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";

import { ApiError } from "../../../shared/api/httpClient";
import { login } from "../api/authApi";
import type { LoginFormData } from "../schemas/loginSchema";

type LoginErrorKind = "credentials" | "network" | "unexpected";

function classifyLoginError(error: unknown): LoginErrorKind {
  if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
    return "credentials";
  }
  if (error instanceof TypeError) {
    return "network";
  }
  return "unexpected";
}

export function useLogin() {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (credentials: LoginFormData) => login(credentials.email, credentials.password),
    onSuccess: async (user) => {
      client.setQueryData(["auth", "me"], user);
      const requestedPath = (location.state as { from?: string } | null)?.from;
      const destination = user.must_change_password
        ? "/account/change-password"
        : (requestedPath ?? "/");
      await navigate(destination, { replace: true });
    },
  });

  return {
    errorKind: mutation.error ? classifyLoginError(mutation.error) : null,
    isPending: mutation.isPending,
    resetError: mutation.reset,
    submit: (credentials: LoginFormData) => {
      mutation.mutate(credentials);
    },
  };
}
