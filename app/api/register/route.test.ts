// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let provisionerToken: string;
let nonProvisionerToken: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
const newUserEmail = "register-route-test@example.com";

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    role: "CREATOR",
    firstName: "New",
    lastName: "User",
    departmentId,
    businessUnitId,
    locationId,
    email: newUserEmail,
    password: "supersecure1",
    confirmPassword: "supersecure1",
    ...overrides,
  };
}

describe("POST /api/register", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });
    departmentId = department.id;
    businessUnitId = businessUnit.id;
    locationId = location.id;

    provisionerToken = await createSessionToken({
      sub: "provisioner_user",
      email: "provisioner@company.com",
      firstName: "Provisioner",
      lastName: "User",
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonProvisionerToken = await createSessionToken({
      sub: "creator_user",
      email: "creator@company.com",
      firstName: "Creator",
      lastName: "User",
      role: "CREATOR",
      department: "Admin",
      mustChangePassword: false,
    });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, validPayload()));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a session without provisioning permission", async () => {
    const response = await POST(
      requestWithCookie(nonProvisionerToken, validPayload())
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 with a message naming the invalid field for a bad email", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload({ email: "bad" }))
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 with a message naming the invalid field for a short password", async () => {
    const response = await POST(
      requestWithCookie(
        provisionerToken,
        validPayload({ password: "short", confirmPassword: "short" })
      )
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/password/i);
  });

  it("creates a user with mustChangePassword true for an authorized provisioner", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload())
    );
    expect(response.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: newUserEmail },
    });
    expect(created.mustChangePassword).toBe(true);
    expect(created.role).toBe("CREATOR");
  });

  it("returns 409 when the email is already registered", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload())
    );
    expect(response.status).toBe(409);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: newUserEmail } });
    await prisma.$disconnect();
  });
});
