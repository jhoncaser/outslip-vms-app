// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let departmentId: string;
let businessUnitId: string;
let locationId: string;
let creatorId: string;
let level1ApproverId: string;
let level1Token: string;
let otherUserId: string;
let otherUserToken: string;
let matrixTypeId: string;
let openStatusId: string;
let pendingTransactionId: string;
let unpostedTransactionId: string;
const createdMatrixTypeApproverIds: string[] = [];
const createdTransactionIds: string[] = [];

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/transactions/x/revise", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/transactions/[id]/revise", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Revise Route Fixture Dept" }, update: {}, create: { name: "Revise Route Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Revise Route Fixture BU" }, update: {}, create: { name: "Revise Route Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Revise Route Fixture Location" }, update: {}, create: { name: "Revise Route Fixture Location" },
    });
    locationId = location.id;

    const creator = await prisma.user.upsert({
      where: { email: "revise-route-fixture-creator@example.com" },
      update: {},
      create: {
        firstName: "Creator", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-creator@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    const level1Approver = await prisma.user.upsert({
      where: { email: "revise-route-fixture-l1@example.com" },
      update: {},
      create: {
        firstName: "Level1", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-l1@example.com", passwordHash: "unused",
        role: "APPROVER", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    level1ApproverId = level1Approver.id;
    level1Token = await createSessionToken({
      sub: level1Approver.id, email: level1Approver.email, firstName: level1Approver.firstName,
      lastName: level1Approver.lastName, role: "APPROVER", department: "Revise Route Fixture Dept",
      mustChangePassword: false,
    });

    const otherUser = await prisma.user.upsert({
      where: { email: "revise-route-fixture-other@example.com" },
      update: {},
      create: {
        firstName: "Other", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-other@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    otherUserId = otherUser.id;
    otherUserToken = await createSessionToken({
      sub: otherUser.id, email: otherUser.email, firstName: otherUser.firstName,
      lastName: otherUser.lastName, role: "CREATOR", department: "Revise Route Fixture Dept",
      mustChangePassword: false,
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Revise Route Fixture Type" },
      update: {},
      create: { matrixCode: "MT-REVISEROUTEFIXTURE", name: "Revise Route Fixture Type", creatorId },
    });
    matrixTypeId = matrixType.id;

    const level1MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level1ApproverId, level: 1, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level1MatrixTypeApprover.id);

    const openStatus = await prisma.transactionStatus.upsert({
      where: { name: "Open" }, update: {}, create: { name: "Open" },
    });
    openStatusId = openStatus.id;

    const pendingTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-REVISEROUTEPENDING", matrixTypeId, statusId: openStatusId,
        creatorId, postedAt: new Date(), reason: "Original reason",
      },
    });
    pendingTransactionId = pendingTransaction.id;
    createdTransactionIds.push(pendingTransactionId);

    const unpostedTransaction = await prisma.transaction.create({
      data: { transactionCode: "OT-REVISEROUTEUNPOSTED", matrixTypeId, statusId: openStatusId, creatorId },
    });
    unpostedTransactionId = unpostedTransaction.id;
    createdTransactionIds.push(unpostedTransactionId);
  });

  it("returns 401 with no session", async () => {
    const response = await POST(
      requestWithCookie(undefined, { reason: "Fix the date" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Fix the date" }),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 when the transaction is not posted", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Fix the date" }),
      paramsFor(unpostedTransactionId)
    );
    expect(response.status).toBe(409);
  });

  it("returns 403 when a non-approver tries to revise", async () => {
    const response = await POST(
      requestWithCookie(otherUserToken, { reason: "Fix the date" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 when the reason is blank", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "   " }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("A reason is required.");
  });

  it("unposts the transaction and stores the reason", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Planned Time doesn't match the actual shift start" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(204);

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: pendingTransactionId } });
    expect(stored.postedAt).toBeNull();
    expect(stored.revisionReason).toBe("Planned Time doesn't match the actual shift start");
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
    await prisma.matrixTypeApprover.deleteMany({ where: { id: { in: createdMatrixTypeApproverIds } } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, level1ApproverId, otherUserId] } } });
    await prisma.businessUnit.deleteMany({ where: { name: "Revise Route Fixture BU" } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
