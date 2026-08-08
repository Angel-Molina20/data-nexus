import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Tabs } from "./Tabs";

describe("Modal", () => {
  it("closes with Escape and exposes dialog semantics", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} open title="Editar conexión">
        <Button>Aceptar</Button>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Editar conexión" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("does not render when closed", () => {
    render(
      <Modal onClose={vi.fn()} open={false} title="Oculto">
        Contenido
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Tabs", () => {
  function Example() {
    const [active, setActive] = useState("results");
    return (
      <Tabs
        activeId={active}
        label="Detalle"
        onChange={setActive}
        tabs={[
          { id: "results", label: "Resultados", content: "Filas" },
          { id: "sql", label: "SQL", content: "SELECT" },
        ]}
      />
    );
  }
  it("changes content by click and keyboard", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("tab", { name: "SQL" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("SELECT");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Resultados" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
