// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let creatorToken: string;
let creatorId: string;
let otherUserToken: string;
let matrixTypeId: string;
let transactionId: string;
let deleteTransactionId: string;
let postedForDeleteTransactionId: string;
let cancelledTransactionId: string;
let zeroApproverTransactionId: string;
let approverMatrixTypeId: string;
let approverId: string;
let approverToken: string;
let approverPendingTransactionId: string;

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/transactions/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
}

function deleteRequestWithCookie(token: string | undefined) {
  return new NextRequest("http://localhost/api/transactions/x", {
    method: "DELETE",
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/transactions/[id]", () => {
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

    const creator = await prisma.user.upsert({
      where: { email: "transaction-id-route-test-creator@example.com" },
      update: {},
      create: {
        firstName: "Post",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transaction-id-route-test-creator@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    creatorToken = await createSessionToken({
      sub: creator.id,
      email: creator.email,
      firstName: creator.firstName,
      lastName: creator.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    const otherUser = await prisma.user.upsert({
      where: { email: "transaction-id-route-test-other@example.com" },
      update: {},
      create: {
        firstName: "Other",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transaction-id-route-test-other@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });

    otherUserToken = await createSessionToken({
      sub: otherUser.id,
      email: otherUser.email,
      firstName: otherUser.firstName,
      lastName: otherUser.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Approved" },
      update: {},
      create: { name: "Approved" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Transaction ID Route Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-TXNIDROUTEFIXTURE",
        name: "Transaction ID Route Fixture Matrix Type",
        creatorId,
      },
    });
    matrixTypeId = matrixType.id;

    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDROUTE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    transactionId = transaction.id;

    const zeroApproverTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDZEROAPPROVER",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    zeroApproverTransactionId = zeroApproverTransaction.id;

    const approverMatrixType = await prisma.matrixType.upsert({
      where: { name: "Transaction ID Route Fixture Matrix Type (with approver)" },
      update: {},
      create: {
        matrixCode: "MT-TXNIDROUTEFIXTUREAPPROVER",
        name: "Transaction ID Route Fixture Matrix Type (with approver)",
        creatorId,
      },
    });
    approverMatrixTypeId = approverMatrixType.id;

    const approver = await prisma.user.upsert({
      where: { email: "transaction-id-route-test-approver@example.com" },
      update: {},
      create: {
        firstName: "Approver",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transaction-id-route-test-approver@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    approverId = approver.id;

    approverToken = await createSessionToken({
      sub: approver.id,
      email: approver.email,
      firstName: approver.firstName,
      lastName: approver.lastName,
      role: "APPROVER",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.matrixTypeApprover.create({
      data: {
        matrixTypeId: approverMatrixTypeId,
        approverId,
        level: 1,
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
      },
    });

    const approverPendingTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDDELETEAPPROVER",
        matrixTypeId: approverMatrixTypeId,
        statusId: openStatus.id,
        creatorId,
        postedAt: new Date(),
      },
    });
    approverPendingTransactionId = approverPendingTransaction.id;

    await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" },
      update: {},
      create: { name: "Cancelled" },
    });
    const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Cancelled" },
    });

    const deleteTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDDELETE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    deleteTransactionId = deleteTransaction.id;

    const postedForDeleteTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDDELETEPOSTED",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
        postedAt: new Date(),
      },
    });
    postedForDeleteTransactionId = postedForDeleteTransaction.id;

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDCANCELLED",
        matrixTypeId,
        statusId: cancelledStatus.id,
        creatorId,
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
  });

  it("returns 401 with no session", async () => {
    const response = await PATCH(
      requestWithCookie(undefined, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns 403 when a non-creator tries to post it", async () => {
    const response = await PATCH(
      requestWithCookie(otherUserToken, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Only the creator can post or unpost this transaction");
  });

  it("returns 400 for an invalid body", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: "yes" }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(400);
  });

  it("posts the transaction, setting postedAt", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.postedAt).not.toBeNull();

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    expect(stored.postedAt).not.toBeNull();
  });

  it("unposts the transaction, clearing postedAt", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: false }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.postedAt).toBeNull();

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    expect(stored.postedAt).toBeNull();
  });

  it("returns 409 when trying to post/unpost an already-cancelled transaction", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor(cancelledTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("This transaction is cancelled.");
  });

  it("posting a transaction with zero configured approvers immediately marks it Approved", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor(zeroApproverTransactionId)
    );
    expect(response.status).toBe(200);

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: zeroApproverTransactionId },
      include: { status: true },
    });
    expect(stored.status.name).toBe("Approved");
  });

  it("DELETE returns 401 with no session", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(undefined),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("DELETE returns 404 for a nonexistent transaction id", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("DELETE returns 403 when a non-creator tries to delete it", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(otherUserToken),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Only the creator or the current approver can delete this transaction");
  });

  it("DELETE returns 409 when the transaction is posted", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(postedForDeleteTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Unpost this transaction before deleting it.");
  });

  it("DELETE allows the pending-level approver to cancel a posted transaction directly", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(approverToken),
      paramsFor(approverPendingTransactionId)
    );
    expect(response.status).toBe(204);

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: approverPendingTransactionId },
      include: { status: true },
    });
    expect(stored.status.name).toBe("Cancelled");
  });

  it("DELETE returns 409 when the transaction is already cancelled", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(cancelledTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Transaction is already cancelled.");
  });

  it("DELETE cancels the transaction, setting status to Cancelled", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(204);

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: deleteTransactionId },
      include: { status: true },
    });
    expect(stored.status.name).toBe("Cancelled");
    expect(stored.postedAt).toBeNull();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [
            transactionId,
            deleteTransactionId,
            postedForDeleteTransactionId,
            cancelledTransactionId,
            zeroApproverTransactionId,
            approverPendingTransactionId,
          ],
        },
      },
    });
    await prisma.matrixTypeApprover.deleteMany({ where: { matrixTypeId: approverMatrixTypeId } });
    await prisma.matrixType.deleteMany({ where: { id: { in: [matrixTypeId, approverMatrixTypeId] } } });
    await prisma.$disconnect();
  });
});
