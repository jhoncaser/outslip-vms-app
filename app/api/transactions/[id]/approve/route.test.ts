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
let level2ApproverId: string;
let level2Token: string;
let otherUserId: string;
let otherUserToken: string;
let matrixTypeId: string;
let openStatusId: string;
let cancelledStatusId: string;
let pendingTransactionId: string;
let lastLevelTransactionId: string;
let unpostedTransactionId: string;
let cancelledTransactionId: string;
let fullyApprovedTransactionId: string;
const createdMatrixTypeApproverIds: string[] = [];
const createdTransactionIds: string[] = [];
const createdTransactionApprovalIds: string[] = [];

function requestWithCookie(token: string | undefined) {
  return new NextRequest("http://localhost/api/transactions/x/approve", {
    method: "POST",
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/transactions/[id]/approve", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Approve Route Fixture Dept" },
      update: {},
      create: { name: "Approve Route Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Approve Route Fixture BU" },
      update: {},
      create: { name: "Approve Route Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Approve Route Fixture Location" },
      update: {},
      create: { name: "Approve Route Fixture Location" },
    });
    locationId = location.id;

    const creator = await prisma.user.upsert({
      where: { email: "approve-route-fixture-creator@example.com" },
      update: {},
      create: {
        firstName: "Creator", lastName: "Fixture", jobTitle: "Tester",
        email: "approve-route-fixture-creator@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    const level1Approver = await prisma.user.upsert({
      where: { email: "approve-route-fixture-l1@example.com" },
      update: {},
      create: {
        firstName: "Level1", lastName: "Fixture", jobTitle: "Tester",
        email: "approve-route-fixture-l1@example.com", passwordHash: "unused",
        role: "APPROVER", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    level1ApproverId = level1Approver.id;
    level1Token = await createSessionToken({
      sub: level1Approver.id, email: level1Approver.email, firstName: level1Approver.firstName,
      lastName: level1Approver.lastName, role: "APPROVER", department: "Approve Route Fixture Dept",
      mustChangePassword: false,
    });

    const level2Approver = await prisma.user.upsert({
      where: { email: "approve-route-fixture-l2@example.com" },
      update: {},
      create: {
        firstName: "Level2", lastName: "Fixture", jobTitle: "Tester",
        email: "approve-route-fixture-l2@example.com", passwordHash: "unused",
        role: "APPROVER", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    level2ApproverId = level2Approver.id;
    level2Token = await createSessionToken({
      sub: level2Approver.id, email: level2Approver.email, firstName: level2Approver.firstName,
      lastName: level2Approver.lastName, role: "APPROVER", department: "Approve Route Fixture Dept",
      mustChangePassword: false,
    });

    const otherUser = await prisma.user.upsert({
      where: { email: "approve-route-fixture-other@example.com" },
      update: {},
      create: {
        firstName: "Other", lastName: "Fixture", jobTitle: "Tester",
        email: "approve-route-fixture-other@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    otherUserId = otherUser.id;
    otherUserToken = await createSessionToken({
      sub: otherUser.id, email: otherUser.email, firstName: otherUser.firstName,
      lastName: otherUser.lastName, role: "CREATOR", department: "Approve Route Fixture Dept",
      mustChangePassword: false,
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Approve Route Fixture Type" },
      update: {},
      create: { matrixCode: "MT-APPROVEROUTEFIXTURE", name: "Approve Route Fixture Type", creatorId },
    });
    matrixTypeId = matrixType.id;

    const level1MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level1ApproverId, level: 1, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level1MatrixTypeApprover.id);

    const level2MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level2ApproverId, level: 2, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level2MatrixTypeApprover.id);

    const openStatus = await prisma.transactionStatus.upsert({
      where: { name: "Open" }, update: {}, create: { name: "Open" },
    });
    openStatusId = openStatus.id;

    const cancelledStatus = await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" }, update: {}, create: { name: "Cancelled" },
    });
    cancelledStatusId = cancelledStatus.id;

    await prisma.transactionStatus.upsert({
      where: { name: "Approved" }, update: {}, create: { name: "Approved" },
    });

    const pendingTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVEROUTEPENDING", matrixTypeId, statusId: openStatusId,
        creatorId, postedAt: new Date(),
      },
    });
    pendingTransactionId = pendingTransaction.id;
    createdTransactionIds.push(pendingTransactionId);

    const lastLevelTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVEROUTELASTLEVEL", matrixTypeId, statusId: openStatusId,
        creatorId, postedAt: new Date(),
      },
    });
    lastLevelTransactionId = lastLevelTransaction.id;
    createdTransactionIds.push(lastLevelTransactionId);
    const level1ApprovalForLastLevel = await prisma.transactionApproval.create({
      data: { transactionId: lastLevelTransactionId, level: 1, approverId: level1ApproverId },
    });
    createdTransactionApprovalIds.push(level1ApprovalForLastLevel.id);

    const unpostedTransaction = await prisma.transaction.create({
      data: { transactionCode: "OT-APPROVEROUTEUNPOSTED", matrixTypeId, statusId: openStatusId, creatorId },
    });
    unpostedTransactionId = unpostedTransaction.id;
    createdTransactionIds.push(unpostedTransactionId);

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVEROUTECANCELLED", matrixTypeId, statusId: cancelledStatusId,
        creatorId, postedAt: new Date(),
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
    createdTransactionIds.push(cancelledTransactionId);

    const fullyApprovedTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVEROUTEFULLYAPPROVED", matrixTypeId, statusId: openStatusId,
        creatorId, postedAt: new Date(),
      },
    });
    fullyApprovedTransactionId = fullyApprovedTransaction.id;
    createdTransactionIds.push(fullyApprovedTransactionId);
    const level1ApprovalForFullyApproved = await prisma.transactionApproval.create({
      data: { transactionId: fullyApprovedTransactionId, level: 1, approverId: level1ApproverId },
    });
    createdTransactionApprovalIds.push(level1ApprovalForFullyApproved.id);
    const level2ApprovalForFullyApproved = await prisma.transactionApproval.create({
      data: { transactionId: fullyApprovedTransactionId, level: 2, approverId: level2ApproverId },
    });
    createdTransactionApprovalIds.push(level2ApprovalForFullyApproved.id);
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined), paramsFor(pendingTransactionId));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await POST(requestWithCookie(level1Token), paramsFor("nonexistent-id"));
    expect(response.status).toBe(404);
  });

  it("returns 409 when the transaction is not posted", async () => {
    const response = await POST(requestWithCookie(level1Token), paramsFor(unpostedTransactionId));
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("This transaction is not posted.");
  });

  it("returns 409 when the transaction is cancelled", async () => {
    const response = await POST(requestWithCookie(level1Token), paramsFor(cancelledTransactionId));
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("This transaction is cancelled.");
  });

  it("returns 409 when the transaction is already fully approved", async () => {
    const response = await POST(requestWithCookie(level1Token), paramsFor(fullyApprovedTransactionId));
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("This transaction is already fully approved.");
  });

  it("returns 403 when a non-approver tries to approve", async () => {
    const response = await POST(requestWithCookie(otherUserToken), paramsFor(pendingTransactionId));
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Only the current level's approver can approve this transaction");
  });

  it("returns 403 when the level-2 approver tries to act before level 1 has approved", async () => {
    const response = await POST(requestWithCookie(level2Token), paramsFor(pendingTransactionId));
    expect(response.status).toBe(403);
  });

  it("approves level 1 and advances to level 2", async () => {
    const response = await POST(requestWithCookie(level1Token), paramsFor(pendingTransactionId));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ pendingLevel: 2, isFullyApproved: false });

    const stored = await prisma.transactionApproval.findUniqueOrThrow({
      where: { transactionId_level: { transactionId: pendingTransactionId, level: 1 } },
    });
    expect(stored.approverId).toBe(level1ApproverId);
  });

  it("approves the final level and marks the transaction Approved", async () => {
    const response = await POST(requestWithCookie(level2Token), paramsFor(lastLevelTransactionId));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ pendingLevel: null, isFullyApproved: true });

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: lastLevelTransactionId },
      include: { status: true },
    });
    expect(stored.status.name).toBe("Approved");
  });

  afterAll(async () => {
    await prisma.transactionApproval.deleteMany({
      where: { transactionId: { in: [...createdTransactionIds, pendingTransactionId] } },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
    await prisma.matrixTypeApprover.deleteMany({ where: { id: { in: createdMatrixTypeApproverIds } } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, level1ApproverId, level2ApproverId, otherUserId] } } });
    await prisma.businessUnit.deleteMany({ where: { name: "Approve Route Fixture BU" } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
