import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { BackButton } from "./BackButton";
import { Breadcrumbs } from "./Breadcrumbs";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

function NavigationPage() {
  return (
    <>
      <BackButton fallback="/queries" label="Volver" />
      <Breadcrumbs
        items={[
          { label: "Inicio", to: "/" },
          { label: "Consultas", to: "/queries" },
          { label: "Actual" },
        ]}
      />
    </>
  );
}

function DirtyEditor() {
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChangesGuard(dirty);
  return (
    <>
      <label>
        Nombre
        <input
          onChange={() => {
            setDirty(true);
          }}
        />
      </label>
      <button
        onClick={() => {
          setDirty(false);
        }}
      >
        Guardar
      </button>
      <Link to="/queries">Ir a consultas</Link>
      <UnsavedChangesDialog onLeave={guard.leave} onStay={guard.stay} open={guard.isBlocked} />
    </>
  );
}

describe("contextual navigation", () => {
  it("uses state.from and renders accessible breadcrumbs", async () => {
    const router = createMemoryRouter(
      [
        { path: "/queries", element: <h1>Consultas</h1> },
        { path: "/reports", element: <h1>Reportes filtrados</h1> },
        { path: "/queries/:id", element: <NavigationPage /> },
      ],
      {
        initialEntries: [
          "/queries",
          { pathname: "/queries/1", state: { from: "/reports?page=2" } },
        ],
      },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("navigation", { name: "Migas de pan" })).toBeInTheDocument();
    expect(screen.getByText("Actual")).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: "Volver" }));
    expect(await screen.findByRole("heading", { name: "Reportes filtrados" })).toBeInTheDocument();
  });

  it("blocks dirty navigation, can stay, and stops warning after saving", async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <Outlet />,
        children: [
          { index: true, element: <DirtyEditor /> },
          { path: "queries", element: <h1>Consultas</h1> },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Cambio");
    await userEvent.click(screen.getByRole("link", { name: "Ir a consultas" }));
    expect(screen.getByRole("dialog", { name: "Tienes cambios sin guardar" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await userEvent.click(screen.getByRole("link", { name: "Ir a consultas" }));
    expect(await screen.findByRole("heading", { name: "Consultas" })).toBeInTheDocument();
  });
});
