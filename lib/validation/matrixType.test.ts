import { describe, it, expect } from "vitest";
import { matrixTypeSchema } from "./matrixType";

describe("matrixTypeSchema", () => {
  it("accepts a valid name", () => {
    const result = matrixTypeSchema.safeParse({ name: "Halfday" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = matrixTypeSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = matrixTypeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
