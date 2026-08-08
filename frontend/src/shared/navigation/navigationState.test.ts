import { describe, expect, it } from "vitest";

import { routes } from "../../app/router/routes";
import { isSafeInternalPath, resolveReturnPath } from "./navigationState";

describe("navigation helpers", () => {
  it("builds encoded dynamic routes", () => {
    expect(routes.queries.builder("query/id")).toBe("/queries/query%2Fid/builder");
    expect(routes.connections.edit("connection id")).toBe("/connections/connection%20id/edit");
  });

  it("accepts only local return paths and uses the fallback otherwise", () => {
    expect(resolveReturnPath({ from: "/queries?page=3&search=student" }, "/queries")).toBe(
      "/queries?page=3&search=student",
    );
    expect(resolveReturnPath({ from: "https://attacker.test" }, "/queries")).toBe("/queries");
    expect(resolveReturnPath({ from: "//attacker.test" }, "/queries")).toBe("/queries");
    expect(isSafeInternalPath("/reports?page=2")).toBe(true);
  });
});
