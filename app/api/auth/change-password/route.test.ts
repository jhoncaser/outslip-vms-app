// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const testEmail = "change-password-route-test@example.com";
let userId: string;
let validToken: string;

function changePasswordRequest(body: unknown, token?: string) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/auth/change-password", () => {
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

    const user = await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        firstName: "Test",
        lastName: "User",
        email: testEmail,
        passwordHash: await hashPassword("temp-password"),
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: true,
      },
    });
    userId = user.id;

    validToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: "ICT",
      mustChangePassword: true,
    });
  });

  it("returns 401 with no session cookie", async () => {
    const response = await POST(
      changePasswordRequest({
        newPassword: "brand-new-password",
        confirmPassword: "brand-new-password",
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for mismatched passwords", async () => {
    const response = await POST(
      changePasswordRequest(
        { newPassword: "brand-new-password", confirmPassword: "different" },
        validToken
      )
    );
    expect(response.status).toBe(400);
  });

  it("updates the password and clears mustChangePassword", async () => {
    const response = await POST(
      changePasswordRequest(
        {
          newPassword: "brand-new-password",
          confirmPassword: "brand-new-password",
        },
        validToken
      )
    );

    expect(response.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(updated.mustChangePassword).toBe(false);
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
