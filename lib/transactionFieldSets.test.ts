import { describe, it, expect } from "vitest";
import {
  TRANSACTION_FIELD_SETS,
  TRANSACTION_FIELD_LABELS,
  findMissingRequiredField,
  getActiveFields,
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

  it("does not require Plate No. for Visitor Pass when Transport Type is Walk-In", () => {
    expect(
      findMissingRequiredField("Visitor Pass", {
        visitorType: "Supplier",
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        personToMeet: "Analyn Gentizon",
        departmentId: "d1",
        reason: "Delivery",
        visitLocation: "Lobby",
        transportType: "Walk-In",
      })
    ).toBeNull();
  });

  it("still requires Plate No. for Visitor Pass when Transport Type is not Walk-In", () => {
    expect(
      findMissingRequiredField("Visitor Pass", {
        visitorType: "Supplier",
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        personToMeet: "Analyn Gentizon",
        departmentId: "d1",
        reason: "Delivery",
        visitLocation: "Lobby",
        transportType: "Car",
      })
    ).toBe("plateNo");
  });
});

describe("getActiveFields", () => {
  it("excludes plateNo from Visitor Pass's field set when Transport Type is Walk-In", () => {
    expect(
      getActiveFields("Visitor Pass", { transportType: "Walk-In" })
    ).toEqual([
      "visitorType",
      "plannedDate",
      "plannedTime",
      "personToMeet",
      "departmentId",
      "reason",
      "visitLocation",
      "transportType",
    ]);
  });

  it("keeps plateNo in Visitor Pass's field set for any other Transport Type", () => {
    expect(getActiveFields("Visitor Pass", { transportType: "Car" })).toEqual(
      TRANSACTION_FIELD_SETS["Visitor Pass"]
    );
  });

  it("keeps plateNo in Visitor Pass's field set when Transport Type isn't set yet", () => {
    expect(getActiveFields("Visitor Pass", {})).toEqual(
      TRANSACTION_FIELD_SETS["Visitor Pass"]
    );
  });

  it("is unaffected by a transportType value for matrix types other than Visitor Pass", () => {
    expect(
      getActiveFields("Halfday", { transportType: "Walk-In" })
    ).toEqual(TRANSACTION_FIELD_SETS["Halfday"]);
  });

  it("returns an empty array for a matrix type with no configured field set", () => {
    expect(getActiveFields("Some Unconfigured Type", {})).toEqual([]);
  });
});
