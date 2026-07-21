import { describe, it, expect } from "vitest";
import { transactionSchema } from "./transaction";

describe("transactionSchema", () => {
  it("accepts a valid matrixTypeId with no other fields", () => {
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

  it("accepts a body with all fields populated", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      plannedDate: "2026-07-25",
      plannedTime: "09:00",
      returnTime: "17:00",
      originBusinessUnit: "Cawit",
      enrouteBusinessUnits: ["Alpha", "Delta"],
      reason: "Client meeting",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an originBusinessUnit value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      originBusinessUnit: "Not A Real Unit",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an enrouteBusinessUnits value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      enrouteBusinessUnits: ["Alpha", "Not A Real Unit"],
    });
    expect(result.success).toBe(false);
  });
});
