// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getApprovalState } from "./transactionApproval";

let departmentId: string;
let businessUnitId: string;
let locationId: string;
let level1ApproverId: string;
let level2ApproverId: string;
let creatorId: string;
let matrixTypeId: string;
let matrixTypeNoApproversId: string;
let transactionId: string;
let transactionNoApproversId: string;
let openStatusId: string;
const createdMatrixTypeApproverIds: string[] = [];
const createdTransactionApprovalIds: string[] = [];

describe("getApprovalState", () => {
  beforeAll(async () => {
    const department = await prisma.department.upsert({
      where: { name: "Approval State Fixture Dept" },
      update: {},
      create: { name: "Approval State Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Approval State Fixture BU" },
      update: {},
      create: { name: "Approval State Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Approval State Fixture Location" },
      update: {},
      create: { name: "Approval State Fixture Location" },
    });
    locationId = location.id;

    const creator = await prisma.user.upsert({
      where: { email: "approval-state-fixture-creator@example.com" },
      update: {},
      create: {
        firstName: "Creator",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "approval-state-fixture-creator@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    const level1Approver = await prisma.user.upsert({
      where: { email: "approval-state-fixture-l1@example.com" },
      update: {},
      create: {
        firstName: "Level1",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "approval-state-fixture-l1@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    level1ApproverId = level1Approver.id;

    const level2Approver = await prisma.user.upsert({
      where: { email: "approval-state-fixture-l2@example.com" },
      update: {},
      create: {
        firstName: "Level2",
        lastName: "Fixture",
        jobTitle: "Tester",
        email: "approval-state-fixture-l2@example.com",
        passwordHash: "unused",
        role: "APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    level2ApproverId = level2Approver.id;

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Approval State Fixture Type" },
      update: {},
      create: {
        matrixCode: "MT-APPROVALSTATEFIXTURE",
        name: "Approval State Fixture Type",
        creatorId,
      },
    });
    matrixTypeId = matrixType.id;

    const matrixTypeNoApprovers = await prisma.matrixType.upsert({
      where: { name: "Approval State Fixture Type (no approvers)" },
      update: {},
      create: {
        matrixCode: "MT-APPROVALSTATEFIXTURENOAPPROVERS",
        name: "Approval State Fixture Type (no approvers)",
        creatorId,
      },
    });
    matrixTypeNoApproversId = matrixTypeNoApprovers.id;

    const level1MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level1ApproverId, level: 1, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level1MatrixTypeApprover.id);

    const level2MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level2ApproverId, level: 2, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level2MatrixTypeApprover.id);

    const openStatus = await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });
    openStatusId = openStatus.id;

    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVALSTATEFIXTURE",
        matrixTypeId,
        statusId: openStatusId,
        creatorId,
      },
    });
    transactionId = transaction.id;

    const transactionNoApprovers = await prisma.transaction.create({
      data: {
        transactionCode: "OT-APPROVALSTATEFIXTURENOAPPROVERS",
        matrixTypeId: matrixTypeNoApproversId,
        statusId: openStatusId,
        creatorId,
      },
    });
    transactionNoApproversId = transactionNoApprovers.id;
  });

  it("returns level 1 as pending when nothing has been approved yet", async () => {
    const state = await getApprovalState(transactionId);
    expect(state.chain.map((a) => a.level)).toEqual([1, 2]);
    expect(state.approvedLevels).toEqual([]);
    expect(state.pendingLevel).toBe(1);
    expect(state.isFullyApproved).toBe(false);
  });

  it("returns level 2 as pending once level 1 has approved", async () => {
    const approval = await prisma.transactionApproval.create({
      data: { transactionId, level: 1, approverId: level1ApproverId },
    });
    createdTransactionApprovalIds.push(approval.id);

    const state = await getApprovalState(transactionId);
    expect(state.approvedLevels).toEqual([1]);
    expect(state.pendingLevel).toBe(2);
    expect(state.isFullyApproved).toBe(false);
  });

  it("returns fully approved once every configured level has approved", async () => {
    const approval = await prisma.transactionApproval.create({
      data: { transactionId, level: 2, approverId: level2ApproverId },
    });
    createdTransactionApprovalIds.push(approval.id);

    const state = await getApprovalState(transactionId);
    expect(state.approvedLevels).toEqual([1, 2]);
    expect(state.pendingLevel).toBeNull();
    expect(state.isFullyApproved).toBe(true);
  });

  it("returns fully approved immediately for a transaction with zero configured approvers", async () => {
    const state = await getApprovalState(transactionNoApproversId);
    expect(state.chain).toEqual([]);
    expect(state.pendingLevel).toBeNull();
    expect(state.isFullyApproved).toBe(true);
  });

  afterAll(async () => {
    await prisma.transactionApproval.deleteMany({ where: { id: { in: createdTransactionApprovalIds } } });
    await prisma.transaction.deleteMany({ where: { id: { in: [transactionId, transactionNoApproversId] } } });
    await prisma.matrixTypeApprover.deleteMany({ where: { id: { in: createdMatrixTypeApproverIds } } });
    await prisma.matrixType.deleteMany({ where: { id: { in: [matrixTypeId, matrixTypeNoApproversId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, level1ApproverId, level2ApproverId] } } });
    await prisma.businessUnit.deleteMany({ where: { name: "Approval State Fixture BU" } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
