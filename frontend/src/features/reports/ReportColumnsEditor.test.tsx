import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportColumnsEditor } from "./ReportColumnsEditor";
import type { ReportColumn } from "./types";

const columns: ReportColumn[] = [
  { source_key: "id", label: "Código", visible: true, position: 0, alignment: "right", format: { type: "integer", null_label: "NULL", true_label: "Sí", false_label: "No" } },
  { source_key: "name", label: "Nombre", visible: true, position: 1, alignment: "left", format: { type: "text", null_label: "NULL", true_label: "Sí", false_label: "No" } },
];

afterEach(cleanup);

describe("ReportColumnsEditor", () => {
  it("updates visibility and labels", () => {
    const onChange = vi.fn();
    render(<ReportColumnsEditor columns={columns} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Mostrar Código"));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ source_key: "id", visible: false }),
    ]));

    fireEvent.change(screen.getByLabelText("Etiqueta de name"), { target: { value: "Estudiante" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ source_key: "name", label: "Estudiante" }),
    ]));
  });

  it("provides a keyboard-compatible ordering alternative", async () => {
    const onChange = vi.fn();
    render(<ReportColumnsEditor columns={columns} onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Bajar Código" });
    await userEvent.click(button);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ source_key: "name", position: 0 }),
      expect.objectContaining({ source_key: "id", position: 1 }),
    ]);
  });
});
