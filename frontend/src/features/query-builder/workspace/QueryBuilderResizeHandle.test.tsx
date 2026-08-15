import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { QueryBuilderResizeHandle } from "./QueryBuilderResizeHandle";

it("supports keyboard resize and reset without changing query state", () => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <QueryBuilderResizeHandle
      direction="vertical"
      label="Redimensionar catálogo"
      max={450}
      min={240}
      onChange={onChange}
      onReset={onReset}
      value={300}
    />,
  );
  const handle = screen.getByRole("separator", { name: "Redimensionar catálogo" });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(onChange).toHaveBeenCalledWith(316);
  fireEvent.doubleClick(handle);
  expect(onReset).toHaveBeenCalledOnce();
});
