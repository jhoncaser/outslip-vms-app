import { describe, it, expect } from "vitest";
import { loginSchema, changePasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "juan@company.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "juan@company.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "newpassword123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});
