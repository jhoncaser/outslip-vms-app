// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let userToken: string;
let userId: string;
let matrixTypeId: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
let halfdayMatrixTypeId: string;
let routingMatrixTypeId: string;
let visitorPassMatrixTypeId: string;
const createdTransactionIds: string[] = [];

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
        departmentId,
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
      where: { name: "Txn Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-TXNFIXTURE",
        name: "Txn Fixture Matrix Type",
        creatorId: user.id,
      },
    });
    matrixTypeId = matrixType.id;

    const halfdayMatrixType = await prisma.matrixType.upsert({
      where: { name: "Halfday" },
      update: {},
      create: {
        matrixCode: "MT-HALFDAYFIXTURE",
        name: "Halfday",
        creatorId: user.id,
      },
    });
    halfdayMatrixTypeId = halfdayMatrixType.id;

    const routingMatrixType = await prisma.matrixType.upsert({
      where: { name: "Routing to other Business Unit" },
      update: {},
      create: {
        matrixCode: "MT-ROUTINGFIXTURE",
        name: "Routing to other Business Unit",
        creatorId: user.id,
      },
    });
    routingMatrixTypeId = routingMatrixType.id;

    const visitorPassMatrixType = await prisma.matrixType.upsert({
      where: { name: "Visitor Pass" },
      update: {},
      create: {
        matrixCode: "MT-VISITORPASSFIXTURE",
        name: "Visitor Pass",
        creatorId: user.id,
      },
    });
    visitorPassMatrixTypeId = visitorPassMatrixType.id;

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
    createdTransactionIds.push(body.id);
    expect(body.transactionCode).toBe(`OT-${String(before + 1).padStart(3, "0")}`);
    expect(body.matrixTypeId).toBe(matrixTypeId);

    const created = await prisma.transaction.findUnique({
      where: { id: body.id },
      include: { status: true },
    });
    expect(created?.creatorId).toBe(userId);
    expect(created?.status.name).toBe("Open");
  });

  it("creates a transaction with all optional fields populated, including Visitor Pass fields, and round-trips them correctly", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        returnTime: "17:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Alpha", "Delta"],
        reason: "Client meeting",
        visitorType: "Supplier",
        personToMeet: "Analyn Gentizon",
        departmentId,
        businessUnitId,
        locationId,
        transportType: "Car",
        plateNo: "ABC-1234",
      })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    createdTransactionIds.push(body.id);
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate?.toISOString().slice(0, 10)).toBe("2026-07-25");
    expect(created.plannedTime?.toISOString().slice(11, 16)).toBe("09:00");
    expect(created.returnTime?.toISOString().slice(11, 16)).toBe("17:00");
    expect(created.originBusinessUnit).toBe("Cawit");
    expect(created.enrouteBusinessUnits).toEqual(["Alpha", "Delta"]);
    expect(created.reason).toBe("Client meeting");
    expect(created.visitorType).toBe("Supplier");
    expect(created.personToMeet).toBe("Analyn Gentizon");
    expect(created.departmentId).toBe(departmentId);
    expect(created.businessUnitId).toBe(businessUnitId);
    expect(created.locationId).toBe(locationId);
    expect(created.transportType).toBe("Car");
    expect(created.plateNo).toBe("ABC-1234");
  });

  it("creates a transaction successfully when all optional fields are omitted", async () => {
    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    createdTransactionIds.push(body.id);
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate).toBeNull();
    expect(created.plannedTime).toBeNull();
    expect(created.returnTime).toBeNull();
    expect(created.originBusinessUnit).toBeNull();
    expect(created.enrouteBusinessUnits).toEqual([]);
    expect(created.reason).toBeNull();
    expect(created.visitorType).toBeNull();
    expect(created.personToMeet).toBeNull();
    expect(created.departmentId).toBeNull();
    expect(created.businessUnitId).toBeNull();
    expect(created.locationId).toBeNull();
    expect(created.transportType).toBeNull();
    expect(created.plateNo).toBeNull();
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

  it("returns 400 for a visitorType value outside the fixed list", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        visitorType: "Not A Real Type",
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

    const staleTransaction = await prisma.transaction.create({
      data: {
        transactionCode: staleCode,
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    createdTransactionIds.push(staleTransaction.id);

    const countSpy = vi
      .spyOn(prisma.transaction, "count")
      .mockResolvedValueOnce(before);

    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    createdTransactionIds.push(body.id);
    expect(body.transactionCode).not.toBe(staleCode);

    countSpy.mockRestore();
  });

  it("returns a specific message when a required field is missing for Halfday", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: halfdayMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Reason is required for this transaction type");
  });

  it("creates a transaction when all of Halfday's required fields are provided", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: halfdayMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        reason: "Family errand",
      })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdTransactionIds.push(body.id);
  });

  it("returns a specific message when Enroute to Other Business Unit is missing for Routing to other Business Unit", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: routingMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        reason: "Delivering documents",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(
      "Enroute to Other Business Unit is required for this transaction type"
    );
  });

  it("creates a transaction when all of Routing to other Business Unit's required fields are provided", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: routingMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Delta"],
        reason: "Delivering documents",
      })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdTransactionIds.push(body.id);
  });

  it("requires nothing beyond the matrix type itself for a type with no configured field set", async () => {
    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);
    const body = await response.json();
    createdTransactionIds.push(body.id);
  });

  it("returns a specific message when Plate No. is missing for Visitor Pass with a non-Walk-In Transport Type", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: visitorPassMatrixTypeId,
        visitorType: "Supplier",
        plannedDate: "2026-07-28",
        plannedTime: "10:30",
        personToMeet: "Analyn Gentizon",
        departmentId,
        businessUnitId,
        locationId,
        reason: "Delivery",
        transportType: "Car",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Plate No. is required for this transaction type");
  });

  it("creates a Visitor Pass transaction with Transport Type Walk-In and no Plate No.", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: visitorPassMatrixTypeId,
        visitorType: "Supplier",
        plannedDate: "2026-07-28",
        plannedTime: "10:30",
        personToMeet: "Analyn Gentizon",
        departmentId,
        businessUnitId,
        locationId,
        reason: "Delivery",
        transportType: "Walk-In",
      })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdTransactionIds.push(body.id);

    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(created.transportType).toBe("Walk-In");
    expect(created.plateNo).toBeNull();
  });

  it("returns a specific message when Business Unit is missing for Visitor Pass", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: visitorPassMatrixTypeId,
        visitorType: "Supplier",
        plannedDate: "2026-07-28",
        plannedTime: "10:30",
        personToMeet: "Analyn Gentizon",
        departmentId,
        locationId,
        reason: "Delivery",
        transportType: "Car",
        plateNo: "ABC-1234",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Business Unit is required for this transaction type");
  });

  it("returns a specific message when Location is missing for Visitor Pass", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: visitorPassMatrixTypeId,
        visitorType: "Supplier",
        plannedDate: "2026-07-28",
        plannedTime: "10:30",
        personToMeet: "Analyn Gentizon",
        departmentId,
        businessUnitId,
        reason: "Delivery",
        transportType: "Car",
        plateNo: "ABC-1234",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Location is required for this transaction type");
  });

  it("creates a Visitor Pass transaction persisting businessUnitId and locationId, and no longer writes visitLocation", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: visitorPassMatrixTypeId,
        visitorType: "Supplier",
        plannedDate: "2026-07-28",
        plannedTime: "10:30",
        personToMeet: "Analyn Gentizon",
        departmentId,
        businessUnitId,
        locationId,
        reason: "Delivery",
        transportType: "Car",
        plateNo: "ABC-1234",
      })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdTransactionIds.push(body.id);
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(created.businessUnitId).toBe(businessUnitId);
    expect(created.locationId).toBe(locationId);
    expect(created.visitLocation).toBeNull();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
