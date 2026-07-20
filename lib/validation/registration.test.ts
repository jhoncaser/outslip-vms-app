import { describe, it, expect } from "vitest";
import { registrationSchema, editUserSchema } from "./registration";

const validPayload = {
  role: "CREATOR",
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  jobTitle: "IT Officer",
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

  it("rejects a missing jobTitle", () => {
    const { jobTitle, ...rest } = validPayload;
    const result = registrationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

const validEditPayload = {
  role: "CREATOR",
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  jobTitle: "IT Officer",
  departmentId: "dept_123",
  businessUnitId: "bu_123",
  locationId: "loc_123",
  email: "juan.delacruz@company.com",
};

describe("editUserSchema", () => {
  it("accepts a valid payload with no password fields", () => {
    const result = editUserSchema.safeParse(validEditPayload);
    expect(result.success).toBe(true);
  });

  it("allows middleName to be omitted", () => {
    const { middleName, ...rest } = validEditPayload;
    const result = editUserSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid role", () => {
    const result = editUserSchema.safeParse({
      ...validEditPayload,
      role: "SUPER_ADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing jobTitle", () => {
    const { jobTitle, ...rest } = validEditPayload;
    const result = editUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const { email, ...rest } = validEditPayload;
    const result = editUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a payload that still has password fields but is missing a required field", () => {
    const { lastName, ...rest } = validEditPayload;
    const result = editUserSchema.safeParse({
      ...rest,
      password: "supersecure1",
      confirmPassword: "supersecure1",
    });
    expect(result.success).toBe(false);
  });
});
