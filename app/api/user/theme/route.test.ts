// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let sessionToken: string;
let userId: string;
const testEmail = "theme-route-test@example.com";

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/user/theme", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("PATCH /api/user/theme", () => {
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

    const user = await prisma.user.create({
      data: {
        firstName: "Theme",
        lastName: "Tester",
        email: testEmail,
        passwordHash: "not-a-real-hash",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
      },
    });
    userId = user.id;

    sessionToken = await createSessionToken({
      sub: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: "ICT",
      mustChangePassword: false,
    });
  });

  it("returns 401 with no session", async () => {
    const response = await PATCH(
      requestWithCookie(undefined, { theme: "DARK" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid theme value", async () => {
    const response = await PATCH(
      requestWithCookie(sessionToken, { theme: "PURPLE" })
    );
    expect(response.status).toBe(400);
  });

  it("updates the caller's own themePreference and returns it", async () => {
    const response = await PATCH(
      requestWithCookie(sessionToken, { theme: "DARK" })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.themePreference).toBe("DARK");

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(updated.themePreference).toBe("DARK");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
