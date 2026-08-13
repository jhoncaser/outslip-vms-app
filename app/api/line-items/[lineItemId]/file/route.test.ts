// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let userToken: string;
let matrixTypeId: string;
let transactionId: string;
let lineItemWithFileId: string;
let lineItemWithoutFileId: string;

function requestWithCookie(token: string | undefined) {
  return new NextRequest("http://localhost/api/line-items/x/file", {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("GET /api/line-items/[lineItemId]/file", () => {
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
      where: { email: "line-item-file-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "File",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-item-file-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });

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
      where: { name: "Line Item File Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIFILEFIXTURE",
        name: "Line Item File Fixture Matrix Type",
        creatorId: user.id,
      },
    });
    matrixTypeId = matrixType.id;

    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-FILEFIXTURE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: user.id,
      },
    });
    transactionId = transaction.id;

    const withFile = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "Analyn Gentizon",
        uploadFileData: Buffer.from("%PDF-1.4 test"),
        uploadFileName: "id.pdf",
        uploadFileType: "application/pdf",
      },
    });
    lineItemWithFileId = withFile.id;

    const withoutFile = await prisma.transactionLineItem.create({
      data: { transactionId, visitorName: "No File Here" },
    });
    lineItemWithoutFileId = withoutFile.id;
  });

  it("returns 401 with no session", async () => {
    const response = await GET(requestWithCookie(undefined), {
      params: Promise.resolve({ lineItemId: lineItemWithFileId }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for a line item with no uploaded file", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: lineItemWithoutFileId }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent line item id", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: "nonexistent-id" }),
    });
    expect(response.status).toBe(404);
  });

  it("streams the file with the correct content-type when authenticated", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: lineItemWithFileId }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const text = await response.text();
    expect(text).toContain("%PDF-1.4 test");
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { transactionId } });
    await prisma.transaction.deleteMany({ where: { id: transactionId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
