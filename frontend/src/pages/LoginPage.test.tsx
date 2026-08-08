import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../features/auth/context";
import { login } from "../features/auth/api/authApi";
import { LoginPage } from "./LoginPage";

vi.mock("../features/auth/api/authApi", () => ({ login: vi.fn() }));

describe("LoginPage", () => {
  it("uses accessible credentials fields and a generic authentication error", async () => {
    vi.mocked(login).mockRejectedValue(new Error("driver detail that must not render"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider
          value={{ user: null, loading: false, logout: vi.fn(), hasPermission: () => false }}
        >
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Correo"), "user@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "invalid-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(
      await screen.findByText("Las credenciales ingresadas no son válidas."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/driver detail/)).not.toBeInTheDocument();
  });
});
