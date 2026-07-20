// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

const testEmail = "login-route-test@example.com";

function loginRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/login", () => {
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

    await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        firstName: "Test",
        lastName: "User",
        jobTitle: "IT Officer",
        email: testEmail,
        passwordHash: await hashPassword("correct-password"),
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
  });

  it("returns 200 and sets a session cookie for correct credentials", async () => {
    const response = await POST(
      loginRequest({ email: testEmail, password: "correct-password" })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("session")).toBeDefined();

    const body = await response.json();
    expect(body.mustChangePassword).toBe(false);
  });

  it("returns 401 for a wrong password", async () => {
    const response = await POST(
      loginRequest({ email: testEmail, password: "wrong-password" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const response = await POST(
      loginRequest({ email: "nobody@example.com", password: "whatever123" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed payload", async () => {
    const response = await POST(loginRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email: testEmail } });
    await prisma.$disconnect();
  });
});
