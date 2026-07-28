import { describe, it, expect } from "vitest";
import {
  TRANSACTION_FIELD_SETS,
  TRANSACTION_FIELD_LABELS,
  findMissingRequiredField,
} from "./transactionFieldSets";

describe("TRANSACTION_FIELD_SETS", () => {
  it("defines the required fields, in order, for each of the six matrix types", () => {
    expect(TRANSACTION_FIELD_SETS["Halfday"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Undertime"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Others"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Out for Lunch"]).toEqual([
      "plannedDate",
      "plannedTime",
      "returnTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Routing to other Business Unit"]).toEqual([
      "plannedDate",
      "plannedTime",
      "originBusinessUnit",
      "enrouteBusinessUnits",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Visitor Pass"]).toEqual([
      "visitorType",
      "plannedDate",
      "plannedTime",
      "personToMeet",
      "departmentId",
      "reason",
      "visitLocation",
      "transportType",
      "plateNo",
    ]);
  });
});

describe("TRANSACTION_FIELD_LABELS", () => {
  it("has a human-readable label for every field key used across TRANSACTION_FIELD_SETS", () => {
    const allKeys = Object.values(TRANSACTION_FIELD_SETS).flat();
    for (const key of allKeys) {
      expect(typeof TRANSACTION_FIELD_LABELS[key]).toBe("string");
      expect(TRANSACTION_FIELD_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("findMissingRequiredField", () => {
  it("returns the first missing required field for a known matrix type", () => {
    expect(
      findMissingRequiredField("Halfday", { plannedDate: "2026-07-25" })
    ).toBe("plannedTime");
  });

  it("returns null when all required fields are present", () => {
    expect(
      findMissingRequiredField("Halfday", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        reason: "Family errand",
      })
    ).toBeNull();
  });

  it("treats an empty string as missing", () => {
    expect(
      findMissingRequiredField("Halfday", {
        plannedDate: "2026-07-25",
        plannedTime: "",
        reason: "Family errand",
      })
    ).toBe("plannedTime");
  });

  it("treats an empty enrouteBusinessUnits array as missing", () => {
    expect(
      findMissingRequiredField("Routing to other Business Unit", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: [],
        reason: "Delivering documents",
      })
    ).toBe("enrouteBusinessUnits");
  });

  it("accepts a non-empty enrouteBusinessUnits array", () => {
    expect(
      findMissingRequiredField("Routing to other Business Unit", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Delta"],
        reason: "Delivering documents",
      })
    ).toBeNull();
  });

  it("returns null (nothing required) for a matrix type with no configured field set", () => {
    expect(findMissingRequiredField("Some Unconfigured Type", {})).toBeNull();
  });
});
