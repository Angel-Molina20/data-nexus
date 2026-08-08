import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../shared/api/httpClient";
import { login } from "../api/authApi";
import { LoginForm } from "./LoginForm";

vi.mock("../api/authApi", () => ({ login: vi.fn() }));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  it("validates required fields and focuses the first invalid control", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("El correo es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Correo/)).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it("keeps the password value while toggling its visibility", async () => {
    renderForm();
    const user = userEvent.setup();
    const password = screen.getByLabelText(/^Contraseña/);
    await user.type(password, "secret-value");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("secret-value");
    await user.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows a safe credentials error without exposing backend details", async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError("driver detail that must not render", "INVALID_CREDENTIALS"),
    );
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Correo/), "user@example.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "invalid-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(screen.queryByText(/driver detail/)).not.toBeInTheDocument();
  });

  it("distinguishes a network failure and prevents duplicate submissions", async () => {
    let rejectRequest: ((reason: unknown) => void) | undefined;
    vi.mocked(login).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Correo/), "user@example.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "secret-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByLabelText(/^Correo/)).toBeDisabled();
    expect(screen.getByLabelText(/^Contraseña/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Iniciando sesión…" })).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);

    rejectRequest?.(new TypeError("Failed to fetch"));
    expect(await screen.findByRole("alert")).toHaveTextContent("DataNexus no está disponible");
  });
});
