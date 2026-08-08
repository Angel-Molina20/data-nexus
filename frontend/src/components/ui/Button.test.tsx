import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogOut } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("renders and handles an interaction", async () => { const user = userEvent.setup(); const onClick = vi.fn(); render(<Button onClick={onClick}>Guardar</Button>); await user.click(screen.getByRole("button", { name: "Guardar" })); expect(onClick).toHaveBeenCalledOnce(); });
  it("blocks disabled and loading interactions", async () => { const user = userEvent.setup(); const onClick = vi.fn(); const { rerender } = render(<Button disabled onClick={onClick}>Guardar</Button>); await user.click(screen.getByRole("button")); expect(onClick).not.toHaveBeenCalled(); rerender(<Button loading onClick={onClick}>Guardando</Button>); expect(screen.getByRole("button")).toBeDisabled(); });
  it("keeps the icon visible in icon-only buttons", () => { render(<IconButton label="Cerrar sesión"><LogOut data-testid="logout-icon" /></IconButton>); expect(screen.getByTestId("logout-icon")).toBeVisible(); expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument(); });
});
