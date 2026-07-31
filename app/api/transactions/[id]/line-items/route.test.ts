// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { deleteLineItemFile, MAX_FILE_SIZE_BYTES } from "@/lib/lineItemFileStorage";

let userToken: string;
let userId: string;
let visitorPassMatrixTypeId: string;
let employeeMatrixTypeId: string;
let visitorPassTransactionId: string;
let employeeTransactionId: string;
const createdLineItemIds: string[] = [];
const savedFileUrls: string[] = [];

function requestWithCookie(token: string | undefined, transactionId: string, body: FormData) {
  return new NextRequest(`http://localhost/api/transactions/${transactionId}/line-items`, {
    method: "POST",
    body,
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(transactionId: string) {
  return { params: Promise.resolve({ id: transactionId }) };
}

describe("POST /api/transactions/[id]/line-items", () => {
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
      where: { email: "line-items-post-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Post",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-items-post-route-test-user@example.com",
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

    const visitorPassMatrixType = await prisma.matrixType.upsert({
      where: { name: "Visitor Pass" },
      update: {},
      create: {
        matrixCode: "MT-LIVISITORPASSFIXTURE",
        name: "Visitor Pass",
        creatorId: userId,
      },
    });
    visitorPassMatrixTypeId = visitorPassMatrixType.id;

    const employeeMatrixType = await prisma.matrixType.upsert({
      where: { name: "Line Item Employee Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIEMPLOYEEFIXTURE",
        name: "Line Item Employee Fixture Matrix Type",
        creatorId: userId,
      },
    });
    employeeMatrixTypeId = employeeMatrixType.id;

    const visitorPassTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIVISITORPASS",
        matrixTypeId: visitorPassMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    visitorPassTransactionId = visitorPassTransaction.id;

    const employeeTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIEMPLOYEE",
        matrixTypeId: employeeMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    employeeTransactionId = employeeTransaction.id;
  });

  it("returns 401 with no session", async () => {
    const response = await POST(
      requestWithCookie(undefined, visitorPassTransactionId, new FormData()),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await POST(
      requestWithCookie(userToken, "nonexistent-id", new FormData()),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns a specific message when a required Visitor Pass field is missing", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Job Title is required");
  });

  it("creates a Visitor Pass line item with all required fields, no file", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    body.set("jobTitle", "Procurement Officer");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Car");
    body.set("plateNo", "ABC-1234");
    body.set("contactNumber", "0917-000-0000");
    body.set("emailAddress", "analyn@example.com");

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.visitorName).toBe("Analyn Gentizon");
    expect(created.jobTitle).toBe("Procurement Officer");
    expect(created.company).toBe("Acme Supplies");
    expect(created.transportType).toBe("Car");
    expect(created.plateNo).toBe("ABC-1234");
    expect(created.contactNumber).toBe("0917-000-0000");
    expect(created.emailAddress).toBe("analyn@example.com");
    expect(created.uploadFileUrl).toBeNull();
  });

  it("returns a specific message when Plate No. is missing for a non-Walk-In transport type", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    body.set("jobTitle", "Procurement Officer");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Car");

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Plate No. is required");
  });

  it("does not require Plate No. when transportType is Walk-In", async () => {
    const body = new FormData();
    body.set("visitorName", "Walk-In Visitor");
    body.set("jobTitle", "Guest");
    body.set("company", "N/A");
    body.set("transportType", "Walk-In");

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);
    expect(created.plateNo).toBeNull();
  });

  it("creates a Visitor Pass line item with an uploaded file", async () => {
    const body = new FormData();
    body.set("visitorName", "Mark Reyes");
    body.set("jobTitle", "Driver");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Walk-In");
    body.set(
      "uploadFile",
      new File([Buffer.from("%PDF-1.4 test")], "id.pdf", { type: "application/pdf" })
    );

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);
    if (created.uploadFileUrl) savedFileUrls.push(created.uploadFileUrl);

    expect(created.uploadFileName).toBe("id.pdf");
    expect(created.uploadFileUrl).toBeTruthy();
  });

  it("rejects an unsupported file type", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    body.set("jobTitle", "Procurement Officer");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Car");
    body.set("plateNo", "ABC-1234");
    body.set(
      "uploadFile",
      new File([Buffer.from("bad")], "virus.exe", { type: "application/x-executable" })
    );

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/unsupported file type/i);
  });

  it("rejects an oversized file (> MAX_FILE_SIZE_BYTES)", async () => {
    const body = new FormData();
    body.set("visitorName", "John Oversized");
    body.set("jobTitle", "Test Officer");
    body.set("company", "Test Corp");
    body.set("transportType", "Car");
    body.set("plateNo", "ABC-1234");
    body.set(
      "uploadFile",
      new File([new Uint8Array(MAX_FILE_SIZE_BYTES + 1)], "too-big.pdf", {
        type: "application/pdf",
      })
    );

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/too large/i);
  });

  it("returns a specific message when Name is missing for a Third-Party employee line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("remarks", "Delivery vendor");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Name is required");
  });

  it("creates a Third-Party employee line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Mark Reyes");
    body.set("remarks", "Delivery vendor");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.employeeType).toBe("Third-Party");
    expect(created.name).toBe("Mark Reyes");
    expect(created.remarks).toBe("Delivery vendor");
    expect(created.employeeId).toBeNull();
  });

  it("creates a Mega Employee line item and ignores a submitted name", async () => {
    const body = new FormData();
    body.set("employeeType", "Mega Employee");
    body.set("employeeId", userId);
    body.set("name", "Should be ignored");
    body.set("remarks", "Sample remarks");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.employeeType).toBe("Mega Employee");
    expect(created.employeeId).toBe(userId);
    expect(created.name).toBeNull();
  });

  it("returns 400 for a Mega Employee line item with a nonexistent employeeId", async () => {
    const body = new FormData();
    body.set("employeeType", "Mega Employee");
    body.set("employeeId", "nonexistent-user-id");
    body.set("remarks", "Sample remarks");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/invalid employee/i);
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { id: { in: createdLineItemIds } } });
    for (const url of savedFileUrls) {
      await deleteLineItemFile(url);
    }
    await prisma.transaction.deleteMany({
      where: { id: { in: [visitorPassTransactionId, employeeTransactionId] } },
    });
    await prisma.matrixType.deleteMany({ where: { id: employeeMatrixTypeId } });
    await prisma.$disconnect();
  });
});
