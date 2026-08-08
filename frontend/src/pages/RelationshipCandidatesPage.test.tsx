import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { listRelationshipCandidates } from "../services/relationships";
import { RelationshipCandidatesPage } from "./RelationshipCandidatesPage";

vi.mock("../services/relationships", () => ({
  confirmRelationshipCandidate: vi.fn(),
  detectRelationshipCandidates: vi.fn(),
  listRelationshipCandidates: vi.fn(),
  rejectRelationshipCandidate: vi.fn(),
}));

const mockedList = vi.mocked(listRelationshipCandidates);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/connections/test/relationships/candidates"]}>
        <Routes>
          <Route
            path="/connections/:id/relationships/candidates"
            element={<RelationshipCandidatesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RelationshipCandidatesPage", () => {
  it("shows deterministic confidence and administrative actions", async () => {
    mockedList.mockResolvedValue({
      items: [
        {
          id: "candidate",
          type: "inferred",
          status: "suggested",
          detection_source: "naming_convention",
          source: {
            entity_id: "enrollments",
            entity_name: "enrollments",
            display_name: "Matrículas",
            fields: ["student_id"],
          },
          target: {
            entity_id: "students",
            entity_name: "students",
            display_name: "Estudiantes",
            fields: ["id"],
          },
          name: "enrollments_student_id_students",
          display_name: "Matrículas → Estudiantes",
          description: null,
          cardinality: "many_to_one",
          confidence: 0.9,
          conditions: [],
          reasons: ["Convención singular_id hacia tabla plural."],
          warnings: [],
          enabled: false,
          invalid_reason: null,
          fingerprint: "stable",
        },
      ],
      total: 1,
      physical: 0,
      confirmed: 0,
      suggested: 1,
      polymorphic: 0,
      invalid: 0,
      bridge_candidates: [],
    });

    renderPage();

    expect(await screen.findByText("90% confianza")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Volver a relaciones" })).toHaveAttribute("href", "/connections/test/relationships");
  });
});
