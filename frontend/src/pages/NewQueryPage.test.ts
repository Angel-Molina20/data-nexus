import { describe, expect, it } from "vitest";

import { querySourceAlias } from "./NewQueryPage";

describe("new query source alias", () => {
  it("uses the physical entity name instead of main", () => {
    expect(querySourceAlias("documents")).toBe("documents");
    expect(querySourceAlias("student_records")).toBe("student_records");
  });

  it("normalizes unusual physical names to a valid portable alias", () => {
    expect(querySourceAlias("2026 Student Records")).toBe("entity_2026_Student_Records");
    expect(querySourceAlias("órdenes-detalle")).toBe("ordenes_detalle");
    expect(querySourceAlias("---")).toBe("entity");
    expect(querySourceAlias("order")).toBe("entity_order");
  });
});
