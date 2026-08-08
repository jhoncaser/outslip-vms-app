import { describe, it, expect } from "vitest";
import { transactionSchema, postTransactionSchema } from "./transaction";

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

  it("accepts a body with all fields populated, including the Visitor Pass fields", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      plannedDate: "2026-07-25",
      plannedTime: "09:00",
      returnTime: "17:00",
      originBusinessUnit: "Cawit",
      enrouteBusinessUnits: ["Alpha", "Delta"],
      reason: "Client meeting",
      visitorType: "Supplier",
      personToMeet: "Analyn Gentizon",
      departmentId: "dept123",
      businessUnitId: "bu123",
      visitLocation: "Lobby, Room 204",
      transportType: "Car",
      plateNo: "ABC-1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessUnitId).toBe("bu123");
      expect(result.data.visitLocation).toBe("Lobby, Room 204");
    }
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

  it("rejects a visitorType value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      visitorType: "Not A Real Type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a transportType value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      transportType: "Not A Real Type",
    });
    expect(result.success).toBe(false);
  });
});

describe("postTransactionSchema", () => {
  it("accepts { posted: true }", () => {
    const result = postTransactionSchema.safeParse({ posted: true });
    expect(result.success).toBe(true);
  });

  it("accepts { posted: false }", () => {
    const result = postTransactionSchema.safeParse({ posted: false });
    expect(result.success).toBe(true);
  });

  it("rejects a missing posted field", () => {
    const result = postTransactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean posted value", () => {
    const result = postTransactionSchema.safeParse({ posted: "true" });
    expect(result.success).toBe(false);
  });
});
