// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { findScopeMatchedApprovers } from "./matchApprovers";

let matrixTypeId: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
let approverId: string;
const createdMatrixTypeApproverIds: string[] = [];

describe("findScopeMatchedApprovers", () => {
  beforeAll(async () => {
    const department = await prisma.department.upsert({
      where: { name: "Match Approvers Fixture Dept" },
      update: {},
      create: { name: "Match Approvers Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Match Approvers Fixture BU" },
      update: {},
      create: { name: "Match Approvers Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Match Approvers Fixture Location" },
      update: {},
      create: { name: "Match Approvers Fixture Location" },
    });
    locationId = location.id;

    const approver = await prisma.user.upsert({
      where: { email: "match-approvers-fixture@example.com" },
      update: {},
      create: {
        firstName: "Approver",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "match-approvers-fixture@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverId = approver.id;

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Match Approvers Fixture Type" },
      update: {},
      create: {
        matrixCode: "MT-MATCHAPPROVERSFIXTURE",
        name: "Match Approvers Fixture Type",
        creatorId: approverId,
      },
    });
    matrixTypeId = matrixType.id;

    const matrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: {
        matrixTypeId,
        approverId,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      },
    });
    createdMatrixTypeApproverIds.push(matrixTypeApprover.id);
  });

  it("returns the matching approver when matrixTypeId, department, business unit, and location all match", async () => {
    const result = await findScopeMatchedApprovers({
      matrixTypeId,
      departmentId,
      businessUnitId,
      locationId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe(1);
    expect(result[0].approverId).toBe(approverId);
    expect(result[0].approverFirstName).toBe("Approver");
    expect(result[0].approverLastName).toBe("Fixture");
  });

  it("returns an empty array when the business unit doesn't match (zero-match case)", async () => {
    const otherBusinessUnit = await prisma.businessUnit.upsert({
      where: { name: "Match Approvers Fixture BU 2 (no approver)" },
      update: {},
      create: { name: "Match Approvers Fixture BU 2 (no approver)" },
    });

    const result = await findScopeMatchedApprovers({
      matrixTypeId,
      departmentId,
      businessUnitId: otherBusinessUnit.id,
      locationId,
    });

    expect(result).toEqual([]);
  });

  afterAll(async () => {
    await prisma.matrixTypeApprover.deleteMany({
      where: { id: { in: createdMatrixTypeApproverIds } },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    // User must go before Department/BusinessUnit/Location: those FKs are RESTRICT.
    await prisma.user.deleteMany({ where: { id: approverId } });
    await prisma.businessUnit.deleteMany({
      where: {
        name: {
          in: ["Match Approvers Fixture BU", "Match Approvers Fixture BU 2 (no approver)"],
        },
      },
    });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
