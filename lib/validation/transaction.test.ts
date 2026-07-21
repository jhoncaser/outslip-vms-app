import { describe, it, expect } from "vitest";
import { transactionSchema } from "./transaction";

describe("transactionSchema", () => {
  it("accepts a valid matrixTypeId", () => {
    const result = transactionSchema.safeParse({ matrixTypeId: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty matrixTypeId", () => {
    const result = transactionSchema.safeParse({ matrixTypeId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing matrixTypeId", () => {
    const result = transactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
