// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { findPendingApprovalTransactionIds } from "./myApprovals";

let departmentId: string;
let businessUnitId: string;
let locationId: string;
let matrixTypeId: string;
let creatorId: string;
let approverLevel1Id: string;
let approverLevel2Id: string;
let outsiderId: string;
let openStatusId: string;
let cancelledStatusId: string;
let approvedStatusId: string;
const createdMatrixTypeApproverIds: string[] = [];
const createdTransactionIds: string[] = [];

describe("findPendingApprovalTransactionIds", () => {
  beforeAll(async () => {
    const department = await prisma.department.upsert({
      where: { name: "My Approvals Fixture Dept" },
      update: {},
      create: { name: "My Approvals Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "My Approvals Fixture BU" },
      update: {},
      create: { name: "My Approvals Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "My Approvals Fixture Location" },
      update: {},
      create: { name: "My Approvals Fixture Location" },
    });
    locationId = location.id;

    const creator = await prisma.user.upsert({
      where: { email: "my-approvals-fixture-creator@example.com" },
      update: {},
      create: {
        firstName: "Creator",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "my-approvals-fixture-creator@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    const approverLevel1 = await prisma.user.upsert({
      where: { email: "my-approvals-fixture-approver1@example.com" },
      update: {},
      create: {
        firstName: "Approver",
        lastName: "LevelOne",
        jobTitle: "Tester",
        email: "my-approvals-fixture-approver1@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverLevel1Id = approverLevel1.id;

    const approverLevel2 = await prisma.user.upsert({
      where: { email: "my-approvals-fixture-approver2@example.com" },
      update: {},
      create: {
        firstName: "Approver",
        lastName: "LevelTwo",
        jobTitle: "Tester",
        email: "my-approvals-fixture-approver2@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverLevel2Id = approverLevel2.id;

    const outsider = await prisma.user.upsert({
      where: { email: "my-approvals-fixture-outsider@example.com" },
      update: {},
      create: {
        firstName: "Outsider",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "my-approvals-fixture-outsider@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    outsiderId = outsider.id;

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "My Approvals Fixture Type" },
      update: {},
      create: {
        matrixCode: "MT-MYAPPROVALSFIXTURE",
        name: "My Approvals Fixture Type",
        creatorId,
      },
    });
    matrixTypeId = matrixType.id;

    const level1Approver = await prisma.matrixTypeApprover.create({
      data: {
        matrixTypeId,
        approverId: approverLevel1Id,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      },
    });
    const level2Approver = await prisma.matrixTypeApprover.create({
      data: {
        matrixTypeId,
        approverId: approverLevel2Id,
        level: 2,
        departmentId,
        businessUnitId,
        locationId,
      },
    });
    createdMatrixTypeApproverIds.push(level1Approver.id, level2Approver.id);

    openStatusId = (
      await prisma.transactionStatus.findUniqueOrThrow({ where: { name: "Open" } })
    ).id;
    cancelledStatusId = (
      await prisma.transactionStatus.findUniqueOrThrow({ where: { name: "Cancelled" } })
    ).id;
    approvedStatusId = (
      await prisma.transactionStatus.findUniqueOrThrow({ where: { name: "Approved" } })
    ).id;
  });

  it("includes a transaction where the given approver is the pending level's approver", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-001",
        matrixTypeId,
        statusId: openStatusId,
        creatorId,
        postedAt: new Date(),
      },
    });
    createdTransactionIds.push(transaction.id);

    const result = await findPendingApprovalTransactionIds(approverLevel1Id);

    expect(result).toContain(transaction.id);
  });

  it("excludes a transaction pending at a different level", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-002",
        matrixTypeId,
        statusId: openStatusId,
        creatorId,
        postedAt: new Date(),
      },
    });
    createdTransactionIds.push(transaction.id);
    await prisma.transactionApproval.create({
      data: { transactionId: transaction.id, level: 1, approverId: approverLevel1Id },
    });

    const level1Result = await findPendingApprovalTransactionIds(approverLevel1Id);
    const level2Result = await findPendingApprovalTransactionIds(approverLevel2Id);

    expect(level1Result).not.toContain(transaction.id);
    expect(level2Result).toContain(transaction.id);
  });

  it("excludes an unposted transaction", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-003",
        matrixTypeId,
        statusId: openStatusId,
        creatorId,
        postedAt: null,
      },
    });
    createdTransactionIds.push(transaction.id);

    const result = await findPendingApprovalTransactionIds(approverLevel1Id);

    expect(result).not.toContain(transaction.id);
  });

  it("excludes a cancelled transaction", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-004",
        matrixTypeId,
        statusId: cancelledStatusId,
        creatorId,
        postedAt: new Date(),
      },
    });
    createdTransactionIds.push(transaction.id);

    const result = await findPendingApprovalTransactionIds(approverLevel1Id);

    expect(result).not.toContain(transaction.id);
  });

  it("excludes a fully-approved transaction", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-005",
        matrixTypeId,
        statusId: approvedStatusId,
        creatorId,
        postedAt: new Date(),
      },
    });
    createdTransactionIds.push(transaction.id);
    await prisma.transactionApproval.createMany({
      data: [
        { transactionId: transaction.id, level: 1, approverId: approverLevel1Id },
        { transactionId: transaction.id, level: 2, approverId: approverLevel2Id },
      ],
    });

    const level1Result = await findPendingApprovalTransactionIds(approverLevel1Id);
    const level2Result = await findPendingApprovalTransactionIds(approverLevel2Id);

    expect(level1Result).not.toContain(transaction.id);
    expect(level2Result).not.toContain(transaction.id);
  });

  it("excludes every transaction for a user not in the approver chain at all", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "MYAPPROVALS-FIXTURE-006",
        matrixTypeId,
        statusId: openStatusId,
        creatorId,
        postedAt: new Date(),
      },
    });
    createdTransactionIds.push(transaction.id);

    const result = await findPendingApprovalTransactionIds(outsiderId);

    expect(result).not.toContain(transaction.id);
  });

  afterAll(async () => {
    await prisma.transactionApproval.deleteMany({
      where: { transactionId: { in: createdTransactionIds } },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
    await prisma.matrixTypeApprover.deleteMany({
      where: { id: { in: createdMatrixTypeApproverIds } },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    // Users must go before Department/BusinessUnit/Location: those FKs are RESTRICT.
    await prisma.user.deleteMany({
      where: { id: { in: [creatorId, approverLevel1Id, approverLevel2Id, outsiderId] } },
    });
    await prisma.businessUnit.deleteMany({ where: { id: businessUnitId } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
