import { CircleOff } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { EmptyStateBase } from "./FeedbackStates";

describe("feedback", () => {
  it("renders an accessible error Alert and closes it", async () => { const user = userEvent.setup(); const onClose = vi.fn(); render(<Alert description="Revisa la conexión" onClose={onClose} title="Error" variant="error" />); expect(screen.getByRole("alert")).toHaveTextContent("Revisa la conexión"); await user.click(screen.getByRole("button", { name: "Cerrar aviso" })); expect(onClose).toHaveBeenCalledOnce(); });
  it("renders EmptyState title, description and action", () => { render(<EmptyStateBase action={<Button>Crear conexión</Button>} description="Registra la primera fuente." icon={CircleOff} title="Sin conexiones" />); expect(screen.getByRole("heading", { name: "Sin conexiones" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Crear conexión" })).toBeInTheDocument(); });
});
