// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "fs";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { deleteLineItemFile, lineItemFilePath, MAX_FILE_SIZE_BYTES } from "@/lib/lineItemFileStorage";

let userToken: string;
let userId: string;
let matrixTypeId: string;
let transactionId: string;
let visitorPassMatrixTypeId: string;
let visitorPassTransactionId: string;
const createdLineItemIds: string[] = [];
const savedFileUrls: string[] = [];

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

  it("replaces an uploaded file and deletes the old one", async () => {
    const oldSaved = await (
      await import("@/lib/lineItemFileStorage")
    ).saveLineItemFile(new File([Buffer.from("old")], "old.pdf", { type: "application/pdf" }));
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId: visitorPassTransactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileUrl: oldSaved.url,
        uploadFileName: oldSaved.fileName,
      },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("visitorName", "V");
    body.set("jobTitle", "J");
    body.set("company", "C");
    body.set("transportType", "Car");
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
    savedFileUrls.push(updated.uploadFileUrl);

    expect(updated.uploadFileName).toBe("new.pdf");
    expect(existsSync(lineItemFilePath(oldSaved.url))).toBe(false);
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

  it("deletes a line item and its file", async () => {
    const saved = await (
      await import("@/lib/lineItemFileStorage")
    ).saveLineItemFile(new File([Buffer.from("x")], "x.pdf", { type: "application/pdf" }));
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileUrl: saved.url,
        uploadFileName: saved.fileName,
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
    expect(existsSync(lineItemFilePath(saved.url))).toBe(false);
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
    for (const url of savedFileUrls) {
      await deleteLineItemFile(url);
    }
    await prisma.transaction.deleteMany({
      where: { id: { in: [transactionId, visitorPassTransactionId] } },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
