// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let adminToken: string;
let nonAdminToken: string;

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/matrix-types", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/matrix-types", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin" },
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

    const adminUser = await prisma.user.upsert({
      where: { email: "matrix-types-route-test-admin@example.com" },
      update: {},
      create: {
        firstName: "Matrix",
        lastName: "Admin",
        jobTitle: "Tester",
        email: "matrix-types-route-test-admin@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });

    adminToken = await createSessionToken({
      sub: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: "APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonAdminToken = await createSessionToken({
      sub: "regular_user",
      email: "regular@company.com",
      firstName: "Regular",
      lastName: "User",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.matrixType.deleteMany({
      where: { name: { startsWith: "Route-Test" } },
    });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(
      requestWithCookie(undefined, { name: "Route-Test A" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-Admin-department user", async () => {
    const response = await POST(
      requestWithCookie(nonAdminToken, { name: "Route-Test B" })
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for an empty name", async () => {
    const response = await POST(requestWithCookie(adminToken, { name: "" }));
    expect(response.status).toBe(400);
  });

  it("creates a matrix type with a sequential code and the session user as creator", async () => {
    const before = await prisma.matrixType.count();

    const response = await POST(
      requestWithCookie(adminToken, { name: "Route-Test C" })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.matrixCode).toBe(`MT-${String(before + 1).padStart(3, "0")}`);
    expect(body.name).toBe("Route-Test C");

    const created = await prisma.matrixType.findUnique({
      where: { name: "Route-Test C" },
    });
    expect(created?.creatorId).toBe((await prisma.user.findUniqueOrThrow({
      where: { email: "matrix-types-route-test-admin@example.com" },
    })).id);
  });

  it("returns 409 when a matrix type with this name already exists", async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: "matrix-types-route-test-admin@example.com" },
    });
    await prisma.matrixType.create({
      data: {
        matrixCode: "MT-DUPTEST",
        name: "Route-Test Duplicate",
        creatorId: adminUser.id,
      },
    });

    const response = await POST(
      requestWithCookie(adminToken, { name: "Route-Test Duplicate" })
    );
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("retries with a new code when the generated matrix code collides", async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: "matrix-types-route-test-admin@example.com" },
    });
    const before = await prisma.matrixType.count();
    const staleCode = `MT-${String(before + 1).padStart(3, "0")}`;

    await prisma.matrixType.create({
      data: {
        matrixCode: staleCode,
        name: "Route-Test Collision Seed",
        creatorId: adminUser.id,
      },
    });

    const countSpy = vi
      .spyOn(prisma.matrixType, "count")
      .mockResolvedValueOnce(before);

    const response = await POST(
      requestWithCookie(adminToken, { name: "Route-Test Retry" })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.matrixCode).not.toBe(staleCode);
    expect(body.name).toBe("Route-Test Retry");

    countSpy.mockRestore();
  });

  afterAll(async () => {
    await prisma.matrixType.deleteMany({
      where: { name: { startsWith: "Route-Test" } },
    });
    await prisma.$disconnect();
  });
});
