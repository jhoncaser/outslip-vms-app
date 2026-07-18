// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "./session";

const samplePayload = {
  sub: "user_123",
  email: "juan@company.com",
  firstName: "Juan",
  lastName: "Dela Cruz",
  role: "FIRST_APPROVER" as const,
  department: "Admin",
  mustChangePassword: false,
};

describe("session tokens", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
  });

  it("round-trips a payload through create and verify", async () => {
    const token = await createSessionToken(samplePayload);
    const verified = await verifySessionToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe(samplePayload.sub);
    expect(verified!.email).toBe(samplePayload.email);
    expect(verified!.role).toBe(samplePayload.role);
    expect(verified!.department).toBe(samplePayload.department);
    expect(verified!.mustChangePassword).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(samplePayload);
    const tampered = token.slice(0, -2) + "xx";
    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    const verified = await verifySessionToken("not-a-real-token");
    expect(verified).toBeNull();
  });

  it("exposes a fixed cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
  });
});
