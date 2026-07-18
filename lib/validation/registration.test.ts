import { describe, it, expect } from "vitest";
import { registrationSchema } from "./registration";

const validPayload = {
  role: "CREATOR",
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  departmentId: "dept_123",
  businessUnitId: "bu_123",
  locationId: "loc_123",
  email: "juan.delacruz@company.com",
  password: "supersecure1",
  confirmPassword: "supersecure1",
};

describe("registrationSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = registrationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("allows middleName to be omitted", () => {
    const { middleName, ...rest } = validPayload;
    const result = registrationSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid role", () => {
    const result = registrationSchema.safeParse({
      ...validPayload,
      role: "SUPER_ADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password/confirmPassword", () => {
    const result = registrationSchema.safeParse({
      ...validPayload,
      confirmPassword: "different1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing lastName", () => {
    const { lastName, ...rest } = validPayload;
    const result = registrationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
