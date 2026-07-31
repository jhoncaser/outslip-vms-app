// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let adminToken: string;
let nonAdminToken: string;
let matrixTypeId: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
let approverAId: string;
let approverBId: string;

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/matrix-type-approvers", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/matrix-type-approvers", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });
    locationId = location.id;

    const adminUser = await prisma.user.upsert({
      where: { email: "matrix-type-approvers-route-test-admin@example.com" },
      update: {},
      create: {
        firstName: "MTA",
        lastName: "Admin",
        jobTitle: "Tester",
        email: "matrix-type-approvers-route-test-admin@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
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

    const approverA = await prisma.user.upsert({
      where: { email: "mta-route-test-approver-a@example.com" },
      update: {},
      create: {
        firstName: "ApproverA",
        lastName: "MtaTest",
        jobTitle: "Tester",
        email: "mta-route-test-approver-a@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverAId = approverA.id;

    const approverB = await prisma.user.upsert({
      where: { email: "mta-route-test-approver-b@example.com" },
      update: {},
      create: {
        firstName: "ApproverB",
        lastName: "MtaTest",
        jobTitle: "Tester",
        email: "mta-route-test-approver-b@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverBId = approverB.id;

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "MTA Route Test Type" },
      update: {},
      create: {
        matrixCode: "MT-MTA-TEST",
        name: "MTA Route Test Type",
        creatorId: adminUser.id,
      },
    });
    matrixTypeId = matrixType.id;

    await prisma.matrixTypeApprover.deleteMany({ where: { matrixTypeId } });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, {}));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-Admin-department user", async () => {
    const response = await POST(requestWithCookie(nonAdminToken, {}));
    expect(response.status).toBe(403);
  });

  it("returns 400 when a required field is missing", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 1,
        departmentId,
        businessUnitId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid level", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 4,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a bad foreign key (unknown approverId)", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: "does-not-exist",
        level: 3,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates an approver assignment", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.matrixTypeId).toBe(matrixTypeId);
    expect(body.approverId).toBe(approverAId);
    expect(body.level).toBe(1);
  });

  it("returns 409 when the same slot is already taken by a different approver", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverBId,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination."
    );
  });

  it("returns 409 when the same approver already holds a different level for this combination", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 2,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination."
    );
  });

  afterAll(async () => {
    await prisma.matrixTypeApprover.deleteMany({ where: { matrixTypeId } });
    await prisma.matrixType.delete({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
