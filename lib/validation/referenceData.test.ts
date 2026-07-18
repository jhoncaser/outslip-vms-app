import { describe, it, expect } from "vitest";
import { referenceDataSchema } from "./referenceData";

describe("referenceDataSchema", () => {
  it("accepts a valid department addition", () => {
    const result = referenceDataSchema.safeParse({
      type: "department",
      name: "Legal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid type", () => {
    const result = referenceDataSchema.safeParse({
      type: "role",
      name: "Legal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = referenceDataSchema.safeParse({
      type: "location",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});
