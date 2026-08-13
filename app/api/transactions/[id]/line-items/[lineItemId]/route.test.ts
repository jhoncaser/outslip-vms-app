// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { MAX_FILE_SIZE_BYTES } from "@/lib/lineItemFileStorage";

let userToken: string;
let userId: string;
let matrixTypeId: string;
let transactionId: string;
let visitorPassMatrixTypeId: string;
let visitorPassTransactionId: string;
let postedTransactionId: string;
let cancelledTransactionId: string;
const createdLineItemIds: string[] = [];

function requestWithCookie(method: string, token: string | undefined, body: FormData) {
  return new NextRequest("http://localhost/api/transactions/x/line-items/y", {
    method,
    body,
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(transactionId: string, lineItemId: string) {
  return { params: Promise.resolve({ id: transactionId, lineItemId }) };
}

describe("PATCH/DELETE /api/transactions/[id]/line-items/[lineItemId]", () => {
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
      where: { email: "line-item-id-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Patch",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-item-id-route-test-user@example.com",
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
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Line Item ID Route Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIIDROUTEFIXTURE",
        name: "Line Item ID Route Fixture Matrix Type",
        creatorId: userId,
      },
    });
    matrixTypeId = matrixType.id;

    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIIDROUTE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    transactionId = transaction.id;

    const visitorPassMatrixType = await prisma.matrixType.upsert({
      where: { name: "Visitor Pass" },
      update: {},
      create: {
        matrixCode: "MT-VISITORPASSFIXTURE",
        name: "Visitor Pass",
        creatorId: userId,
      },
    });
    visitorPassMatrixTypeId = visitorPassMatrixType.id;

    const visitorPassTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-IDVISITORPASS",
        matrixTypeId: visitorPassMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    visitorPassTransactionId = visitorPassTransaction.id;

    const postedTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-IDPOSTED",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
        postedAt: new Date(),
      },
    });
    postedTransactionId = postedTransaction.id;

    await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" },
      update: {},
      create: { name: "Cancelled" },
    });
    const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Cancelled" },
    });

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-IDCANCELLED",
        matrixTypeId,
        statusId: cancelledStatus.id,
        creatorId: userId,
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
  });

  it("returns 401 with no session on PATCH", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await PATCH(
      requestWithCookie("PATCH", undefined, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(401);
  });

  it("edits an employee-variant line item's fields", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "Old Name", remarks: "Old" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "New Name");
    body.set("remarks", "New remarks");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe("New Name");
    expect(updated.remarks).toBe("New remarks");
  });

  it("returns a specific message when a required field is missing on PATCH", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("remarks", "New remarks");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Name is required");
  });

  it("returns 404 when editing a nonexistent line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "X");
    body.set("remarks", "X");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, "nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("replaces an uploaded file's bytes when a new one is submitted", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId: visitorPassTransactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileData: Buffer.from("old"),
        uploadFileName: "old.pdf",
        uploadFileType: "application/pdf",
      },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("visitorName", "V");
    body.set("jobTitle", "J");
    body.set("company", "C");
    body.set("transportType", "Car");
    body.set("plateNo", "ABC-1234");
    body.set(
      "uploadFile",
      new File([Buffer.from("new")], "new.pdf", { type: "application/pdf" })
    );

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(visitorPassTransactionId, lineItem.id)
    );
    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.uploadFileName).toBe("new.pdf");
    expect(updated.uploadFileData).toBeUndefined();

    const stored = await prisma.transactionLineItem.findUniqueOrThrow({
      where: { id: lineItem.id },
    });
    expect(Buffer.from(stored.uploadFileData!).toString()).toBe("new");
  });

  it("rejects an oversized file (> MAX_FILE_SIZE_BYTES) on PATCH", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId: visitorPassTransactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
      },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("visitorName", "V");
    body.set("jobTitle", "J");
    body.set("company", "C");
    body.set("transportType", "Car");
    body.set("plateNo", "ABC-1234");
    body.set(
      "uploadFile",
      new File([new Uint8Array(MAX_FILE_SIZE_BYTES + 1)], "too-big.pdf", {
        type: "application/pdf",
      })
    );

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(visitorPassTransactionId, lineItem.id)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/too large/i);
  });

  it("returns 409 when PATCHing a line item on a posted transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: postedTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Should Not Update");
    body.set("remarks", "X");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(postedTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a posted transaction.");
  });

  it("returns 409 when DELETEing a line item on a posted transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: postedTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await DELETE(
      requestWithCookie("DELETE", userToken, new FormData()),
      paramsFor(postedTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a posted transaction.");

    const stillThere = await prisma.transactionLineItem.findUnique({ where: { id: lineItem.id } });
    expect(stillThere).not.toBeNull();
  });

  it("returns 409 when PATCHing a line item on a cancelled transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: cancelledTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Should Not Update");
    body.set("remarks", "X");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(cancelledTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a cancelled transaction.");
  });

  it("returns 409 when DELETEing a line item on a cancelled transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: cancelledTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await DELETE(
      requestWithCookie("DELETE", userToken, new FormData()),
      paramsFor(cancelledTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a cancelled transaction.");

    const stillThere = await prisma.transactionLineItem.findUnique({ where: { id: lineItem.id } });
    expect(stillThere).not.toBeNull();
  });

  it("deletes a line item along with its stored file bytes", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileData: Buffer.from("x"),
        uploadFileName: "x.pdf",
        uploadFileType: "application/pdf",
      },
    });

    const response = await DELETE(
      requestWithCookie("DELETE", userToken, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(204);

    const stillThere = await prisma.transactionLineItem.findUnique({
      where: { id: lineItem.id },
    });
    expect(stillThere).toBeNull();
  });

  it("returns 401 with no session on DELETE", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await DELETE(
      requestWithCookie("DELETE", undefined, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(401);
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { id: { in: createdLineItemIds } } });
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [transactionId, visitorPassTransactionId, postedTransactionId, cancelledTransactionId],
        },
      },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
