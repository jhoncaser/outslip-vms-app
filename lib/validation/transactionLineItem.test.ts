import { describe, it, expect } from "vitest";
import {
  visitorPassLineItemSchema,
  employeeLineItemSchema,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "./transactionLineItem";

describe("visitorPassLineItemSchema", () => {
  it("accepts a fully populated payload", () => {
    const result = visitorPassLineItemSchema.safeParse({
      visitorName: "Analyn Gentizon",
      jobTitle: "Procurement Officer",
      company: "Acme Supplies",
      contactNumber: "0917-000-0000",
      emailAddress: "analyn@example.com",
      transportType: "Car",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty emailAddress (optional field)", () => {
    const result = visitorPassLineItemSchema.safeParse({
      emailAddress: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid emailAddress format", () => {
    const result = visitorPassLineItemSchema.safeParse({
      emailAddress: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a transportType outside the fixed list", () => {
    const result = visitorPassLineItemSchema.safeParse({
      transportType: "Spaceship",
    });
    expect(result.success).toBe(false);
  });
});

describe("findMissingVisitorPassLineItemField", () => {
  it("returns the first missing required field", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
      })
    ).toBe("jobTitle");
  });

  it("returns null when all required fields are present", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
        jobTitle: "Procurement Officer",
        company: "Acme Supplies",
        transportType: "Car",
      })
    ).toBeNull();
  });

  it("treats an empty string as missing", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
        jobTitle: "",
        company: "Acme Supplies",
        transportType: "Car",
      })
    ).toBe("jobTitle");
  });
});

describe("employeeLineItemSchema", () => {
  it("accepts a Mega Employee payload", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Mega Employee",
      employeeId: "user-1",
      remarks: "Sample remarks",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Third-Party payload", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Third-Party",
      name: "Mark Reyes",
      remarks: "Delivery vendor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an employeeType outside the fixed list", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Contractor",
    });
    expect(result.success).toBe(false);
  });
});

describe("findMissingEmployeeLineItemField", () => {
  it("requires employeeId (not name) when employeeType is Mega Employee", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        name: "Should be ignored",
        remarks: "Sample",
      })
    ).toBe("employeeId");
  });

  it("requires name (not employeeId) when employeeType is Third-Party", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Third-Party",
        remarks: "Sample",
      })
    ).toBe("name");
  });

  it("requires name when employeeType is Visitor", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Visitor",
        remarks: "Sample",
      })
    ).toBe("name");
  });

  it("requires employeeType first, before name/employeeId/remarks", () => {
    expect(findMissingEmployeeLineItemField({})).toBe("employeeType");
  });

  it("requires remarks last", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        employeeId: "user-1",
      })
    ).toBe("remarks");
  });

  it("returns null when everything required is present (Mega Employee)", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        employeeId: "user-1",
        remarks: "Sample",
      })
    ).toBeNull();
  });

  it("returns null when everything required is present (Third-Party)", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Third-Party",
        name: "Mark Reyes",
        remarks: "Sample",
      })
    ).toBeNull();
  });
});

describe("field labels", () => {
  it("has a label for every Visitor Pass required field key", () => {
    for (const key of ["visitorName", "jobTitle", "company", "transportType"] as const) {
      expect(typeof VISITOR_PASS_LINE_ITEM_LABELS[key]).toBe("string");
    }
  });

  it("has a label for every employee-variant field key", () => {
    for (const key of ["employeeType", "employeeId", "name", "remarks"] as const) {
      expect(typeof EMPLOYEE_LINE_ITEM_LABELS[key]).toBe("string");
    }
  });
});
