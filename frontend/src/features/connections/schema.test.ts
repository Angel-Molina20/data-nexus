import { describe, expect, it } from "vitest";

import { connectionSchema, editConnectionSchema } from "./schema";

const valid = {
  name: "Analytics",
  engine: "mysql" as const,
  host: "mysql8",
  port: 3306,
  database_name: "analytics",
  username: "reader",
  password: "secret",
  ssl_enabled: false,
  configuration: {},
};

describe("connection schemas", () => {
  it("rejects an empty password when creating", () => {
    expect(connectionSchema.safeParse({ ...valid, password: "" }).success).toBe(false);
  });

  it("allows an empty password when editing", () => {
    expect(editConnectionSchema.safeParse({ ...valid, password: "" }).success).toBe(true);
  });

  it("rejects invalid ports", () => {
    expect(connectionSchema.safeParse({ ...valid, port: 70000 }).success).toBe(false);
  });
});
