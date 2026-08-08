import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";
import { Select } from "./Select";

describe("form controls", () => {
  it("associates Input labels, help and errors", () => {
    render(<Input error="Campo requerido" helperText="Nombre interno" label="Nombre" />);
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("Campo requerido"));
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
  it("changes a Select option and supports disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        disabled={false}
        label="Motor"
        onChange={onChange}
        options={[{ label: "MySQL", value: "mysql" }]}
        placeholder="Selecciona"
      />,
    );
    await user.selectOptions(screen.getByLabelText("Motor"), "mysql");
    expect(onChange).toHaveBeenCalledOnce();
  });
  it("exposes Select loading state", () => {
    render(<Select label="Motor" loading options={[]} />);
    expect(screen.getByLabelText("Motor")).toBeDisabled();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });
});
