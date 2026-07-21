// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let userToken: string;
let userId: string;
let matrixTypeId: string;

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/transactions", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/transactions", () => {
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
      where: { email: "transactions-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Trans",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transactions-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    userId = user.id;

    userToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Route-Test Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-ROUTETEST",
        name: "Route-Test Matrix Type",
        creatorId: user.id,
      },
    });
    matrixTypeId = matrixType.id;

    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, { matrixTypeId }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty matrixTypeId", async () => {
    const response = await POST(
      requestWithCookie(userToken, { matrixTypeId: "" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a non-existent matrixTypeId", async () => {
    const response = await POST(
      requestWithCookie(userToken, { matrixTypeId: "nonexistent-id" })
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toMatch(/invalid transaction type/i);
  });

  it("creates a transaction with a sequential code, Open status, and the session user as creator", async () => {
    const before = await prisma.transaction.count();

    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.transactionCode).toBe(`OT-${String(before + 1).padStart(3, "0")}`);
    expect(body.matrixTypeId).toBe(matrixTypeId);

    const created = await prisma.transaction.findUnique({
      where: { id: body.id },
      include: { status: true },
    });
    expect(created?.creatorId).toBe(userId);
    expect(created?.status.name).toBe("Open");
  });

  it("creates a transaction with all optional fields populated and round-trips them correctly", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        returnTime: "17:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Alpha", "Delta"],
        reason: "Client meeting",
      })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate?.toISOString().slice(0, 10)).toBe("2026-07-25");
    expect(created.plannedTime?.toISOString().slice(11, 16)).toBe("09:00");
    expect(created.returnTime?.toISOString().slice(11, 16)).toBe("17:00");
    expect(created.originBusinessUnit).toBe("Cawit");
    expect(created.enrouteBusinessUnits).toEqual(["Alpha", "Delta"]);
    expect(created.reason).toBe("Client meeting");
  });

  it("creates a transaction successfully when all optional fields are omitted", async () => {
    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate).toBeNull();
    expect(created.plannedTime).toBeNull();
    expect(created.returnTime).toBeNull();
    expect(created.originBusinessUnit).toBeNull();
    expect(created.enrouteBusinessUnits).toEqual([]);
    expect(created.reason).toBeNull();
  });

  it("returns 400 for an originBusinessUnit value outside the fixed list", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        originBusinessUnit: "Not A Real Unit",
      })
    );
    expect(response.status).toBe(400);
  });

  it("retries with a new code when the generated transaction code collides", async () => {
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });
    const before = await prisma.transaction.count();
    const staleCode = `OT-${String(before + 1).padStart(3, "0")}`;

    await prisma.transaction.create({
      data: {
        transactionCode: staleCode,
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });

    const countSpy = vi
      .spyOn(prisma.transaction, "count")
      .mockResolvedValueOnce(before);

    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.transactionCode).not.toBe(staleCode);

    countSpy.mockRestore();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
