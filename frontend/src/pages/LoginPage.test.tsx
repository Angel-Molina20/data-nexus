import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../features/auth/context";
import { login } from "../features/auth/api/authApi";
import { LoginPage } from "./LoginPage";

vi.mock("../features/auth/api/authApi", () => ({ login: vi.fn() }));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  it("restores the requested route after a successful login", async () => {
    vi.mocked(login).mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      full_name: "Usuario DataNexus",
      status: "active",
      roles: ["analyst"],
      permissions: [],
      must_change_password: false,
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider
          value={{ user: null, loading: false, logout: vi.fn(), hasPermission: () => false }}
        >
          <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/reports" } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reports" element={<h1>Reportes protegidos</h1>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Correo/), "user@example.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "valid-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("heading", { name: "Reportes protegidos" })).toBeInTheDocument();
    expect(client.getQueryData(["auth", "me"])).toMatchObject({ email: "user@example.com" });
  });

  it("does not flash the form while the existing session is being restored", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider
          value={{ user: null, loading: true, logout: vi.fn(), hasPermission: () => false }}
        >
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Comprobando tu sesión…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });

  it("redirects an existing valid session without rendering the login form", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider
          value={{
            user: {
              id: "user-id",
              email: "user@example.com",
              full_name: "Usuario DataNexus",
              status: "active",
              roles: ["analyst"],
              permissions: [],
              must_change_password: false,
            },
            loading: false,
            logout: vi.fn(),
            hasPermission: () => false,
          }}
        >
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<h1>Dashboard existente</h1>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Dashboard existente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });
});
