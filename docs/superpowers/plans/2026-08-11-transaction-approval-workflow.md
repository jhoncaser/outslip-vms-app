# Transaction Approval Workflow (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a transaction's configured approvers Approve, Revise, or Cancel it in strict level order, per `docs/superpowers/specs/2026-08-11-transaction-approval-workflow-design.md`.

**Architecture:** A new `TransactionApproval` table (one row per approved level — its existence is the only state needed) plus a `Transaction.revisionReason` field back the workflow. A single `getApprovalState` helper computes "whose turn is it" everywhere it's needed. Three backend actions (`POST .../approve`, `POST .../revise`, and an extended `DELETE`) enforce it, and the transaction detail page gets three new buttons/modals to exercise them.

**Tech Stack:** Next.js route handlers, Prisma (Postgres), React client components, Vitest + Testing Library.

## Global Constraints

- Approval is strictly sequential: a level can only act once every level below it has an `TransactionApproval` row. This is enforced server-side in every action, not just hidden in the UI.
- `TransactionApproval` rows are never deleted or updated by Revise — see Task 1's rationale. Revise only clears `Transaction.postedAt` and sets `Transaction.revisionReason`.
- A transaction with zero configured approvers is treated as immediately fully approved once posted — no level to wait for.
- Approver-initiated Cancel bypasses the existing "unpost this transaction before deleting it" `409` (creator-initiated Cancel keeps that rule unchanged).
- Approver-initiated Cancel sets the exact same `"Cancelled"` status as creator-initiated Cancel — no new status, no new page, it already shows on Canceled Transactions for free.
- Out of scope for this round (do not build): the "My Approvals" worklist page, status display on the Open Transactions list page, the "Approved Transaction" page, any notification on revision, and revision history (only the latest `revisionReason` is kept).

---

### Task 1: Data model — `TransactionApproval`, `revisionReason`, `"Approved"` status, `getApprovalState`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed.test.ts`
- Modify: `lib/matchApprovers.ts`
- Modify: `lib/matchApprovers.test.ts`
- Create: `lib/transactionApproval.ts`
- Test: `lib/transactionApproval.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TransactionApproval` Prisma model; `Transaction.revisionReason: string | null`; a `"Approved"` `TransactionStatus` row; `ScopeMatchedApprover.approverId: string` (new field on the existing type); `getApprovalState(transactionId: string): Promise<{ chain: ScopeMatchedApprover[]; approvedLevels: number[]; pendingLevel: number | null; isFullyApproved: boolean }>` from `@/lib/transactionApproval`. Tasks 2-4 and 7 all import `getApprovalState`.

- [ ] **Step 1: Write the failing tests**

In `prisma/seed.test.ts`, change:

```ts
  it("seeds the Open and Cancelled transaction statuses", async () => {
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses.map((s) => s.name)).toEqual(["Open", "Cancelled"]);
  });
```

to:

```ts
  it("seeds the Open, Cancelled, and Approved transaction statuses", async () => {
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses.map((s) => s.name)).toEqual(["Open", "Cancelled", "Approved"]);
  });
```

In `lib/matchApprovers.test.ts`, change:

```ts
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe(1);
    expect(result[0].approverFirstName).toBe("Approver");
    expect(result[0].approverLastName).toBe("Fixture");
```

to:

```ts
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe(1);
    expect(result[0].approverId).toBe(approverId);
    expect(result[0].approverFirstName).toBe("Approver");
    expect(result[0].approverLastName).toBe("Fixture");
```

Create `lib/transactionApproval.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run prisma/seed.test.ts lib/matchApprovers.test.ts`
Expected: FAIL — `"Approved"` not yet seeded, `approverId` not yet on the returned rows.
Run: `npx vitest run lib/transactionApproval.test.ts`
Expected: FAIL — `./transactionApproval` doesn't exist, and `prisma.transactionApproval` doesn't exist on the Prisma Client yet.

- [ ] **Step 3: Add the schema changes**

In `prisma/schema.prisma`, change the `User` model's relations block:

```prisma
  matrixTypesCreated  MatrixType[]
  transactionsCreated Transaction[]
  approverAssignments MatrixTypeApprover[]

  lineItemAssignments TransactionLineItem[]
}
```

to:

```prisma
  matrixTypesCreated  MatrixType[]
  transactionsCreated Transaction[]
  approverAssignments MatrixTypeApprover[]

  lineItemAssignments  TransactionLineItem[]
  transactionApprovals TransactionApproval[]
}
```

Change the `Transaction` model's final two fields:

```prisma
  lineItems TransactionLineItem[]
  postedAt  DateTime?
}
```

to:

```prisma
  lineItems TransactionLineItem[]
  postedAt  DateTime?

  approvals      TransactionApproval[]
  revisionReason String?
}
```

At the end of the file, after `TransactionLineItem`'s closing brace, append:

```prisma

model TransactionApproval {
  id        String   @id @default(cuid())
  level     Int
  decidedAt DateTime @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id])
  transactionId String

  approver   User   @relation(fields: [approverId], references: [id])
  approverId String

  @@unique([transactionId, level])
}
```

- [ ] **Step 4: Add "Approved" to the seed array**

In `prisma/seed.ts`, change:

```ts
const TRANSACTION_STATUSES = ["Open", "Cancelled"];
```

to:

```ts
const TRANSACTION_STATUSES = ["Open", "Cancelled", "Approved"];
```

- [ ] **Step 5: Run the migration**

Run: `npx prisma migrate dev --name add_transaction_approval` (additive-only: one new table, one new nullable column — no destructive-change prompt expected).
Run: `npx prisma generate` (usually automatic after `migrate dev`, run explicitly if the client doesn't appear updated).

- [ ] **Step 6: Add `approverId` to `findScopeMatchedApprovers`'s return type**

In `lib/matchApprovers.ts`, change:

```ts
export type ScopeMatchedApprover = {
  id: string;
  level: number;
  approverFirstName: string;
  approverLastName: string;
};
```

to:

```ts
export type ScopeMatchedApprover = {
  id: string;
  level: number;
  approverId: string;
  approverFirstName: string;
  approverLastName: string;
};
```

Then change:

```ts
  const rows = await prisma.matrixTypeApprover.findMany({
    where: {
      matrixTypeId,
      departmentId,
      businessUnitId,
      locationId,
    },
    include: { approver: { select: { firstName: true, lastName: true } } },
    orderBy: { level: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    level: row.level,
    approverFirstName: row.approver.firstName,
    approverLastName: row.approver.lastName,
  }));
```

to:

```ts
  const rows = await prisma.matrixTypeApprover.findMany({
    where: {
      matrixTypeId,
      departmentId,
      businessUnitId,
      locationId,
    },
    include: { approver: { select: { firstName: true, lastName: true } } },
    orderBy: { level: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    level: row.level,
    approverId: row.approverId,
    approverFirstName: row.approver.firstName,
    approverLastName: row.approver.lastName,
  }));
```

- [ ] **Step 7: Write `getApprovalState`**

Create `lib/transactionApproval.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { findScopeMatchedApprovers, type ScopeMatchedApprover } from "@/lib/matchApprovers";

export type ApprovalState = {
  chain: ScopeMatchedApprover[];
  approvedLevels: number[];
  pendingLevel: number | null;
  isFullyApproved: boolean;
};

export async function getApprovalState(transactionId: string): Promise<ApprovalState> {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    select: {
      matrixTypeId: true,
      creator: { select: { departmentId: true, businessUnitId: true, locationId: true } },
    },
  });

  const chain = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const approvals = await prisma.transactionApproval.findMany({
    where: { transactionId },
    select: { level: true },
  });
  const approvedLevels = approvals.map((approval) => approval.level).sort((a, b) => a - b);

  const pendingChainEntry = chain.find((approver) => !approvedLevels.includes(approver.level));
  const pendingLevel = pendingChainEntry ? pendingChainEntry.level : null;

  return { chain, approvedLevels, pendingLevel, isFullyApproved: pendingLevel === null };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run prisma/seed.test.ts lib/matchApprovers.test.ts lib/transactionApproval.test.ts`
Expected: PASS, all tests including the new ones.

- [ ] **Step 9: Run the full suite to check for collateral breakage**

Run: `npx vitest run`
Expected: same pre-existing baseline as always (seed-admin drift + reference-data drift in `prisma/seed.test.ts`), nothing else new.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/seed.test.ts lib/matchApprovers.ts lib/matchApprovers.test.ts lib/transactionApproval.ts lib/transactionApproval.test.ts prisma/migrations
git commit -m "Add TransactionApproval model, revisionReason, Approved status, getApprovalState"
```

---

### Task 2: `POST /api/transactions/[id]/approve`, and auto-approve on Post when zero approvers are configured

**Files:**
- Create: `app/api/transactions/[id]/approve/route.ts`
- Test: `app/api/transactions/[id]/approve/route.test.ts`
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getApprovalState` from Task 1.
- Produces: `POST /api/transactions/[id]/approve` — no body. Responses: `401`, `404`, `409` (`{ error: "This transaction is not posted." }` / `{ error: "This transaction is cancelled." }` / `{ error: "This transaction is already fully approved." }`), `403` (`{ error: "Only the current level's approver can approve this transaction" }`), `200` (`{ pendingLevel: number | null, isFullyApproved: boolean }`). Task 7's UI calls this.

- [ ] **Step 1: Write the failing tests**

Create `app/api/transactions/[id]/approve/route.test.ts`:

```ts
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
```

Also, in `app/api/transactions/[id]/route.test.ts`, this file's shared `transactionId` fixture is posted and unposted by several existing tests earlier in the file — reusing it for the new auto-approve assertion would make the result depend on test execution order. Add a dedicated fixture instead, matching this file's own convention for scenario-specific transactions (`deleteTransactionId`, `postedForDeleteTransactionId`, etc., are all separate rows, never reused across scenarios).

Add a new module-level `let` declaration alongside the existing ones:

```ts
let zeroApproverTransactionId: string;
```

In `beforeAll`, immediately after the existing `transactionId = transaction.id;` line, add:

```ts
    const zeroApproverTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDZEROAPPROVER",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    zeroApproverTransactionId = zeroApproverTransaction.id;
```

(This file's existing `matrixTypeId` fixture, `"Transaction ID Route Fixture Matrix Type"`, has no `MatrixTypeApprover` rows configured for it — the same zero-approvers condition this new test needs.)

Add this new test anywhere after `beforeAll`, before `afterAll`:

```ts
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
```

Change `afterAll`'s transaction cleanup array to include the new fixture:

```ts
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [transactionId, deleteTransactionId, postedForDeleteTransactionId, cancelledTransactionId, zeroApproverTransactionId],
        },
      },
    });
```

This file's `beforeAll` creates `openStatus` via upsert — also add an `"Approved"` upsert alongside it (immediately after the existing `"Open"` upsert block):

```ts
    await prisma.transactionStatus.upsert({
      where: { name: "Approved" },
      update: {},
      create: { name: "Approved" },
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/approve/route.test.ts"`
Expected: FAIL — `./route` doesn't exist yet.
Run: `npx vitest run "app/api/transactions/[id]/route.test.ts"`
Expected: FAIL — the new "immediately marks it Approved" test gets a status other than `"Approved"`, since posting doesn't check approval state yet.

- [ ] **Step 3: Write the approve route**

Create `app/api/transactions/[id]/approve/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getApprovalState } from "@/lib/transactionApproval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { postedAt: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.postedAt === null) {
    return NextResponse.json({ error: "This transaction is not posted." }, { status: 409 });
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json({ error: "This transaction is cancelled." }, { status: 409 });
  }

  const state = await getApprovalState(id);

  if (state.pendingLevel === null) {
    return NextResponse.json(
      { error: "This transaction is already fully approved." },
      { status: 409 }
    );
  }

  const pendingIndex = state.chain.findIndex((approver) => approver.level === state.pendingLevel);
  const pendingApprover = state.chain[pendingIndex];

  if (pendingApprover.approverId !== session.sub) {
    return NextResponse.json(
      { error: "Only the current level's approver can approve this transaction" },
      { status: 403 }
    );
  }

  await prisma.transactionApproval.create({
    data: { transactionId: id, level: pendingApprover.level, approverId: session.sub },
  });

  const isLastLevel = pendingIndex === state.chain.length - 1;
  const nextPendingLevel = isLastLevel ? null : state.chain[pendingIndex + 1].level;

  if (isLastLevel) {
    const approvedStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Approved" },
    });
    await prisma.transaction.update({ where: { id }, data: { statusId: approvedStatus.id } });
  }

  return NextResponse.json(
    { pendingLevel: nextPendingLevel, isFullyApproved: isLastLevel },
    { status: 200 }
  );
}
```

- [ ] **Step 4: Auto-approve on Post when there's no one to wait for**

In `app/api/transactions/[id]/route.ts`, add this import alongside the existing ones:

```ts
import { getApprovalState } from "@/lib/transactionApproval";
```

Change the `PATCH` handler's update block:

```ts
  const updated = await prisma.transaction.update({
    where: { id },
    data: { postedAt: parsed.data.posted ? new Date() : null },
    select: { postedAt: true },
  });

  return NextResponse.json(
    { postedAt: updated.postedAt ? updated.postedAt.toISOString() : null },
    { status: 200 }
  );
```

to:

```ts
  const updated = await prisma.transaction.update({
    where: { id },
    data: { postedAt: parsed.data.posted ? new Date() : null },
    select: { postedAt: true },
  });

  if (parsed.data.posted) {
    const state = await getApprovalState(id);
    if (state.isFullyApproved) {
      const approvedStatus = await prisma.transactionStatus.findUniqueOrThrow({
        where: { name: "Approved" },
      });
      await prisma.transaction.update({ where: { id }, data: { statusId: approvedStatus.id } });
    }
  }

  return NextResponse.json(
    { postedAt: updated.postedAt ? updated.postedAt.toISOString() : null },
    { status: 200 }
  );
```

(`getApprovalState` only ever returns `isFullyApproved: true` immediately after posting when the chain has zero configured approvers — any real chain starts with `pendingLevel: 1`, so this never fires for a transaction that actually needs approval.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run "app/api/transactions/[id]/approve/route.test.ts" "app/api/transactions/[id]/route.test.ts"`
Expected: PASS, all tests in both files.

- [ ] **Step 6: Run the full suite to check for collateral breakage**

Run: `npx vitest run`
Expected: same pre-existing baseline, nothing else new.

- [ ] **Step 7: Commit**

```bash
git add "app/api/transactions/[id]/approve" "app/api/transactions/[id]/route.ts" "app/api/transactions/[id]/route.test.ts"
git commit -m "Add POST /api/transactions/[id]/approve and auto-approve on post"
```

---

### Task 3: `POST /api/transactions/[id]/revise`

**Files:**
- Create: `app/api/transactions/[id]/revise/route.ts`
- Test: `app/api/transactions/[id]/revise/route.test.ts`

**Interfaces:**
- Consumes: `getApprovalState` from Task 1.
- Produces: `POST /api/transactions/[id]/revise` — body `{ reason: string }`. Responses: `401`, `404`, `409` (same three messages as Approve), `400` (`{ error: "A reason is required." }`), `403` (`{ error: "Only the current level's approver can revise this transaction" }`), `204` No Content on success. Task 7's UI calls this.

- [ ] **Step 1: Write the failing tests**

Create `app/api/transactions/[id]/revise/route.test.ts`:

```ts
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
let otherUserId: string;
let otherUserToken: string;
let matrixTypeId: string;
let openStatusId: string;
let pendingTransactionId: string;
let unpostedTransactionId: string;
const createdMatrixTypeApproverIds: string[] = [];
const createdTransactionIds: string[] = [];

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/transactions/x/revise", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/transactions/[id]/revise", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Revise Route Fixture Dept" }, update: {}, create: { name: "Revise Route Fixture Dept" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Revise Route Fixture BU" }, update: {}, create: { name: "Revise Route Fixture BU" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Revise Route Fixture Location" }, update: {}, create: { name: "Revise Route Fixture Location" },
    });
    locationId = location.id;

    const creator = await prisma.user.upsert({
      where: { email: "revise-route-fixture-creator@example.com" },
      update: {},
      create: {
        firstName: "Creator", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-creator@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    const level1Approver = await prisma.user.upsert({
      where: { email: "revise-route-fixture-l1@example.com" },
      update: {},
      create: {
        firstName: "Level1", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-l1@example.com", passwordHash: "unused",
        role: "APPROVER", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    level1ApproverId = level1Approver.id;
    level1Token = await createSessionToken({
      sub: level1Approver.id, email: level1Approver.email, firstName: level1Approver.firstName,
      lastName: level1Approver.lastName, role: "APPROVER", department: "Revise Route Fixture Dept",
      mustChangePassword: false,
    });

    const otherUser = await prisma.user.upsert({
      where: { email: "revise-route-fixture-other@example.com" },
      update: {},
      create: {
        firstName: "Other", lastName: "Fixture", jobTitle: "Tester",
        email: "revise-route-fixture-other@example.com", passwordHash: "unused",
        role: "CREATOR", departmentId, businessUnitId, locationId, mustChangePassword: false,
      },
    });
    otherUserId = otherUser.id;
    otherUserToken = await createSessionToken({
      sub: otherUser.id, email: otherUser.email, firstName: otherUser.firstName,
      lastName: otherUser.lastName, role: "CREATOR", department: "Revise Route Fixture Dept",
      mustChangePassword: false,
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Revise Route Fixture Type" },
      update: {},
      create: { matrixCode: "MT-REVISEROUTEFIXTURE", name: "Revise Route Fixture Type", creatorId },
    });
    matrixTypeId = matrixType.id;

    const level1MatrixTypeApprover = await prisma.matrixTypeApprover.create({
      data: { matrixTypeId, approverId: level1ApproverId, level: 1, departmentId, businessUnitId, locationId },
    });
    createdMatrixTypeApproverIds.push(level1MatrixTypeApprover.id);

    const openStatus = await prisma.transactionStatus.upsert({
      where: { name: "Open" }, update: {}, create: { name: "Open" },
    });
    openStatusId = openStatus.id;

    const pendingTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-REVISEROUTEPENDING", matrixTypeId, statusId: openStatusId,
        creatorId, postedAt: new Date(), reason: "Original reason",
      },
    });
    pendingTransactionId = pendingTransaction.id;
    createdTransactionIds.push(pendingTransactionId);

    const unpostedTransaction = await prisma.transaction.create({
      data: { transactionCode: "OT-REVISEROUTEUNPOSTED", matrixTypeId, statusId: openStatusId, creatorId },
    });
    unpostedTransactionId = unpostedTransaction.id;
    createdTransactionIds.push(unpostedTransactionId);
  });

  it("returns 401 with no session", async () => {
    const response = await POST(
      requestWithCookie(undefined, { reason: "Fix the date" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Fix the date" }),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 when the transaction is not posted", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Fix the date" }),
      paramsFor(unpostedTransactionId)
    );
    expect(response.status).toBe(409);
  });

  it("returns 403 when a non-approver tries to revise", async () => {
    const response = await POST(
      requestWithCookie(otherUserToken, { reason: "Fix the date" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 when the reason is blank", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "   " }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("A reason is required.");
  });

  it("unposts the transaction and stores the reason", async () => {
    const response = await POST(
      requestWithCookie(level1Token, { reason: "Planned Time doesn't match the actual shift start" }),
      paramsFor(pendingTransactionId)
    );
    expect(response.status).toBe(204);

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: pendingTransactionId } });
    expect(stored.postedAt).toBeNull();
    expect(stored.revisionReason).toBe("Planned Time doesn't match the actual shift start");
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
    await prisma.matrixTypeApprover.deleteMany({ where: { id: { in: createdMatrixTypeApproverIds } } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, level1ApproverId, otherUserId] } } });
    await prisma.businessUnit.deleteMany({ where: { name: "Revise Route Fixture BU" } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/revise/route.test.ts"`
Expected: FAIL — `./route` doesn't exist yet.

- [ ] **Step 3: Write the revise route**

Create `app/api/transactions/[id]/revise/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getApprovalState } from "@/lib/transactionApproval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { postedAt: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.postedAt === null) {
    return NextResponse.json({ error: "This transaction is not posted." }, { status: 409 });
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json({ error: "This transaction is cancelled." }, { status: 409 });
  }

  const state = await getApprovalState(id);

  if (state.pendingLevel === null) {
    return NextResponse.json(
      { error: "This transaction is already fully approved." },
      { status: 409 }
    );
  }

  const pendingApprover = state.chain.find((approver) => approver.level === state.pendingLevel);

  if (!pendingApprover || pendingApprover.approverId !== session.sub) {
    return NextResponse.json(
      { error: "Only the current level's approver can revise this transaction" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  await prisma.transaction.update({
    where: { id },
    data: { postedAt: null, revisionReason: reason },
  });

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/transactions/[id]/revise/route.test.ts"`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite to check for collateral breakage**

Run: `npx vitest run`
Expected: same pre-existing baseline, nothing else new.

- [ ] **Step 6: Commit**

```bash
git add "app/api/transactions/[id]/revise"
git commit -m "Add POST /api/transactions/[id]/revise"
```

---

### Task 4: Extend `DELETE /api/transactions/[id]` for approver-initiated Cancel

**Files:**
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getApprovalState` from Task 1 (already imported into this file by Task 2).
- Produces: nothing new for later tasks — `DELETE` keeps its existing `204`/`404`/`409` contract; only the `403` condition and the posted-check's exemption for approvers change.

- [ ] **Step 1: Write the failing tests**

In `app/api/transactions/[id]/route.test.ts`, add new module-level `let` declarations alongside the existing ones:

```ts
let approverMatrixTypeId: string;
let approverId: string;
let approverToken: string;
let approverPendingTransactionId: string;
```

In `beforeAll`, immediately after Task 2's `zeroApproverTransactionId = zeroApproverTransaction.id;` line (the last thing Task 2 added to this file's `beforeAll`), add a **separate** matrix type, its approver, and a transaction under it. This must be a distinct matrix type from the shared `matrixTypeId` — that one is relied on by Task 2's zero-configured-approvers test to stay approver-free, and adding a `MatrixTypeApprover` row to it here would silently break that test:

```ts
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
```

Add these two tests after the existing `"DELETE returns 409 when the transaction is posted"` test:

```ts
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
```

Change `afterAll`'s cleanup array — Task 2 (already landed) added `zeroApproverTransactionId` to this same array, so the "before" state here includes it:

```ts
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
          ],
        },
      },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
```

to:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/route.test.ts"`
Expected: FAIL — the new approver-cancel test gets `409` (posted, blocked) instead of `204`.

- [ ] **Step 3: Extend the DELETE handler's permission logic**

Change:

```ts
  if (transaction.creatorId !== session.sub) {
    return NextResponse.json(
      { error: "Only the creator can delete this transaction" },
      { status: 403 }
    );
  }

  if (transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Unpost this transaction before deleting it." },
      { status: 409 }
    );
  }
```

to:

```ts
  const isCreator = transaction.creatorId === session.sub;
  let isPendingApprover = false;

  if (transaction.postedAt !== null && transaction.status.name !== "Cancelled") {
    const state = await getApprovalState(id);
    const pendingApprover = state.chain.find((approver) => approver.level === state.pendingLevel);
    isPendingApprover = pendingApprover?.approverId === session.sub;
  }

  if (!isCreator && !isPendingApprover) {
    return NextResponse.json(
      { error: "Only the creator or the current approver can delete this transaction" },
      { status: 403 }
    );
  }

  if (transaction.postedAt !== null && !isPendingApprover) {
    return NextResponse.json(
      { error: "Unpost this transaction before deleting it." },
      { status: 409 }
    );
  }
```

(`getApprovalState` and its import are already present in this file from Task 2 — no new import needed here.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/transactions/[id]/route.test.ts"`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/transactions/[id]/route.ts" "app/api/transactions/[id]/route.test.ts"
git commit -m "Allow the pending-level approver to cancel a posted transaction directly"
```

---

### Task 5: `ApproveTransactionModal` component

**Files:**
- Create: `components/dashboard/ApproveTransactionModal.tsx`
- Test: `components/dashboard/ApproveTransactionModal.test.tsx`

**Interfaces:**
- Consumes: `buttonPrimary`, `buttonSecondary` from `@/lib/deepForest` (existing).
- Produces: `ApproveTransactionModal({ transactionCode, matrixTypeName, isFinalLevel, submitting, error, onCancel, onConfirm })`. Task 7 imports and renders this from `@/components/dashboard/ApproveTransactionModal`.

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/ApproveTransactionModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ApproveTransactionModal } from "./ApproveTransactionModal";

describe("ApproveTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /approve this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("shows next-level copy when not the final level", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/moves the transaction to the next level/i)).toBeInTheDocument();
  });

  it("shows final-approval copy when it is the final level", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={true}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/this is the final approval/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm when Approve is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both buttons while submitting and shows Approving…", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /approving/i })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error="Something went wrong"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("does not dismiss on backdrop click or Escape", () => {
    const onCancel = vi.fn();
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/dashboard/ApproveTransactionModal.test.tsx`
Expected: FAIL — `./ApproveTransactionModal` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `components/dashboard/ApproveTransactionModal.tsx`:

```tsx
"use client";

import { buttonPrimary, buttonSecondary } from "@/lib/deepForest";

export function ApproveTransactionModal({
  transactionCode,
  matrixTypeName,
  isFinalLevel,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  transactionCode: string;
  matrixTypeName: string;
  isFinalLevel: boolean;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approve-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] p-6 text-center shadow-[0_0_40px_rgba(44,112,1,0.3)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#57e34c]/18 text-xl">
          ✅
        </div>
        <h2
          id="approve-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Approve this transaction?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-4 text-xs text-[#9db894]">
          {isFinalLevel
            ? "This is the final approval — the transaction will be marked Approved."
            : "This moves the transaction to the next level of approval."}
        </p>
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`flex-1 ${buttonSecondary} px-4 py-2 text-xs`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-1 ${buttonPrimary} px-4 py-2 text-xs`}
          >
            {submitting ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/dashboard/ApproveTransactionModal.test.tsx`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ApproveTransactionModal.tsx components/dashboard/ApproveTransactionModal.test.tsx
git commit -m "Add shared ApproveTransactionModal component"
```

---

### Task 6: `ReviseTransactionModal` component

**Files:**
- Create: `components/dashboard/ReviseTransactionModal.tsx`
- Test: `components/dashboard/ReviseTransactionModal.test.tsx`

**Interfaces:**
- Consumes: `buttonSecondary` from `@/lib/deepForest` (existing).
- Produces: `ReviseTransactionModal({ transactionCode, matrixTypeName, submitting, error, onCancel, onConfirm })` where `onConfirm: (reason: string) => void` — the only modal in this plan whose confirm callback carries a value. Task 7 imports and renders this from `@/components/dashboard/ReviseTransactionModal`.

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/ReviseTransactionModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ReviseTransactionModal } from "./ReviseTransactionModal";

describe("ReviseTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /send back for revision/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not submit when the reason is blank", () => {
    const onConfirm = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /send for revision/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/reason is required/i);
  });

  it("calls onConfirm with the typed reason", () => {
    const onConfirm = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Planned Time doesn't match the actual shift start" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send for revision/i }));
    expect(onConfirm).toHaveBeenCalledWith("Planned Time doesn't match the actual shift start");
  });

  it("disables the textarea and both buttons while submitting", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/reason/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("shows a server error message when provided", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error="Something went wrong"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("does not dismiss on backdrop click or Escape", () => {
    const onCancel = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/dashboard/ReviseTransactionModal.test.tsx`
Expected: FAIL — `./ReviseTransactionModal` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `components/dashboard/ReviseTransactionModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { buttonSecondary } from "@/lib/deepForest";

export function ReviseTransactionModal({
  transactionCode,
  matrixTypeName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  transactionCode: string;
  matrixTypeName: string;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("A reason is required.");
      return;
    }
    setValidationError("");
    onConfirm(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revise-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[360px] overflow-hidden rounded-xl border border-[#fbbf24]/35 bg-[#0c120a] p-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.2)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fbbf24]/18 text-xl">
          ✏️
        </div>
        <h2
          id="revise-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Send back for revision?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-3 text-xs text-[#9db894]">
          The transaction reopens for editing. Earlier approvals stay in place — only your level
          (and any above it) will need to re-approve once resubmitted.
        </p>
        <div className="mb-3 text-left">
          <label
            htmlFor="revise-transaction-reason"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#cfe9c7]"
          >
            Reason (shown to the creator)
          </label>
          <textarea
            id="revise-transaction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            className="w-full rounded border border-[#fbbf24]/40 bg-[#0f1611] px-2 py-1.5 text-xs text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#fbbf24] focus:outline-none disabled:opacity-60"
            rows={3}
            placeholder="e.g. Planned Time doesn't match the actual shift start..."
          />
        </div>
        {(validationError || error) && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {validationError || error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`flex-1 ${buttonSecondary} px-4 py-2 text-xs`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#b45309] px-4 py-2 text-xs font-semibold text-[#1a1206] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(251,191,36,0.35)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#fbbf24]/50 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {submitting ? "Sending…" : "Send for Revision"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/dashboard/ReviseTransactionModal.test.tsx`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ReviseTransactionModal.tsx components/dashboard/ReviseTransactionModal.test.tsx
git commit -m "Add shared ReviseTransactionModal component"
```

---

### Task 7: Detail-page wiring — approver actions and the revision-reason banner

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: `getApprovalState` from Task 1; `POST .../approve` from Task 2; `POST .../revise` from Task 3; the extended `DELETE` from Task 4 (already wired into this page's existing Cancel button — no change needed there); `ApproveTransactionModal` from Task 5; `ReviseTransactionModal` from Task 6.
- Produces: nothing further — this is the last task.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, append this new `describe` block at the very end of the file:

```tsx
describe("TransactionDetailView — Approver actions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })));
  });

  const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };

  it("does not render approver buttons for a non-pending-approver viewer", () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^revise$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it("renders Approve/Revise/Cancel for the pending-level approver", () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^revise$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("opens the approve modal and calls the approve endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    const dialog = screen.getByRole("dialog", { name: /approve this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^approve$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/approve",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("opens the revise modal and calls the revise endpoint with the reason on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^revise$/i }));
    const dialog = screen.getByRole("dialog", { name: /send back for revision/i });
    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: "Please double check the planned time" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /send for revision/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/revise",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Please double check the planned time" }),
        })
      )
    );
  });

  it("approver Cancel opens the existing CancelTransactionModal and calls DELETE", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("shows the revision reason banner when present", () => {
    const revisedTransaction = { ...visitorPassTransaction, revisionReason: "Fix the planned date" };
    render(
      <TransactionDetailView
        transaction={revisedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.getByText(/fix the planned date/i)).toBeInTheDocument();
  });

  it("does not show the revision reason banner when absent", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.queryByText(/revision requested/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: FAIL — no approver buttons, no revision banner, `revisionReason`/`isPendingApprover`/`isFinalApprovalLevel` props don't exist yet.

- [ ] **Step 3: Add `revisionReason` to `TransactionDetailData` and the new props**

In `TransactionDetailView.tsx`, change:

```tsx
export type TransactionDetailData = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  statusName: string;
  createdBy: string;
  createdAt: string;
  postedAt: string | null;
  detailFields: { label: string; value: string }[];
};
```

to:

```tsx
export type TransactionDetailData = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  statusName: string;
  createdBy: string;
  createdAt: string;
  postedAt: string | null;
  revisionReason?: string | null;
  detailFields: { label: string; value: string }[];
};
```

(Optional, not required — this file's existing test fixtures (`visitorPassTransaction`, `otherTransaction`, and everything spread from them across the file's other `describe` blocks) don't include this field, and TypeScript would reject every one of those object literals if it were required. `undefined` renders the same as `null` for the banner's `{transaction.revisionReason && (...)}` check below, so nothing behavioral changes — only the new tests that care about the banner set it explicitly.)

Add these imports alongside the existing modal imports:

```tsx
import { ApproveTransactionModal } from "@/components/dashboard/ApproveTransactionModal";
import { ReviseTransactionModal } from "@/components/dashboard/ReviseTransactionModal";
```

Change the component's props:

```tsx
export function TransactionDetailView({
  transaction,
  lineItems,
  employees,
  remarksDefault,
  approvers = [],
  isOwner = false,
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
  isOwner?: boolean;
}) {
```

to:

```tsx
export function TransactionDetailView({
  transaction,
  lineItems,
  employees,
  remarksDefault,
  approvers = [],
  isOwner = false,
  isPendingApprover = false,
  isFinalApprovalLevel = false,
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
  isOwner?: boolean;
  isPendingApprover?: boolean;
  isFinalApprovalLevel?: boolean;
}) {
```

- [ ] **Step 4: Add approver-action state and handlers**

Immediately after the existing `handleConfirmCancel` function's closing `}` (right before the `return (` that starts the JSX), add:

```tsx
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approveError, setApproveError] = useState("");

  async function handleConfirmApprove() {
    setApproveError("");
    setApproveSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setApproveError(data.error ?? "Failed to approve transaction");
        setApproveSubmitting(false);
        return;
      }

      setApproveSubmitting(false);
      setShowApproveModal(false);
      router.refresh();
    } catch {
      setApproveError("An error occurred while approving the transaction");
      setApproveSubmitting(false);
    }
  }

  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseSubmitting, setReviseSubmitting] = useState(false);
  const [reviseError, setReviseError] = useState("");

  async function handleConfirmRevise(reason: string) {
    setReviseError("");
    setReviseSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setReviseError(data.error ?? "Failed to revise transaction");
        setReviseSubmitting(false);
        return;
      }

      setReviseSubmitting(false);
      setShowReviseModal(false);
      router.refresh();
    } catch {
      setReviseError("An error occurred while revising the transaction");
      setReviseSubmitting(false);
    }
  }
```

- [ ] **Step 5: Render the approver buttons and the revision-reason banner**

Change the button row:

```tsx
        <div className="flex items-center gap-2">
          {isOwner && !isCancelled && (
            <button
              type="button"
              onClick={handlePostButtonClick}
              disabled={postSubmitting}
              className={`${isPosted ? buttonSecondary : buttonPrimary} px-5 py-2 text-xs`}
            >
              {postSubmitting ? "Saving…" : isPosted ? "UNPOST" : "POST"}
            </button>
          )}
          {isOwner && !isLocked && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-full border border-red-500/40 bg-transparent px-5 py-2 text-xs font-semibold text-red-400 transition-colors duration-150 hover:border-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/40 motion-reduce:transition-none"
            >
              DELETE
            </button>
          )}
          {!isLocked && (
            <button
              type="button"
              onClick={openCreateModal}
              className={`${buttonPrimary} px-5 py-2 text-xs`}
            >
              + Add Line Item
            </button>
          )}
        </div>
```

to:

```tsx
        <div className="flex items-center gap-2">
          {isOwner && !isCancelled && (
            <button
              type="button"
              onClick={handlePostButtonClick}
              disabled={postSubmitting}
              className={`${isPosted ? buttonSecondary : buttonPrimary} px-5 py-2 text-xs`}
            >
              {postSubmitting ? "Saving…" : isPosted ? "UNPOST" : "POST"}
            </button>
          )}
          {isOwner && !isLocked && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-full border border-red-500/40 bg-transparent px-5 py-2 text-xs font-semibold text-red-400 transition-colors duration-150 hover:border-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/40 motion-reduce:transition-none"
            >
              DELETE
            </button>
          )}
          {isPendingApprover && (
            <>
              <button
                type="button"
                onClick={() => setShowApproveModal(true)}
                className={`${buttonPrimary} px-5 py-2 text-xs`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setShowReviseModal(true)}
                className="rounded-full border border-[#fbbf24]/40 bg-transparent px-5 py-2 text-xs font-semibold text-[#fbbf24] transition-colors duration-150 hover:border-[#fbbf24] hover:bg-[#fbbf24]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#fbbf24]/40 motion-reduce:transition-none"
              >
                Revise
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="rounded-full border border-red-500/40 bg-transparent px-5 py-2 text-xs font-semibold text-red-400 transition-colors duration-150 hover:border-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/40 motion-reduce:transition-none"
              >
                Cancel
              </button>
            </>
          )}
          {!isLocked && (
            <button
              type="button"
              onClick={openCreateModal}
              className={`${buttonPrimary} px-5 py-2 text-xs`}
            >
              + Add Line Item
            </button>
          )}
        </div>
```

(The approver's Cancel button reuses the exact same `showCancelModal`/`CancelTransactionModal`/`handleConfirmCancel` the owner's Cancel button already uses — no new state, since both roles' cancel action calls the identical `DELETE` endpoint.)

Immediately after that button row's closing `</div>` (right before the existing `{postError && !showPostModal && (` block), add the revision-reason banner:

```tsx
      {transaction.revisionReason && (
        <div className="mb-3 rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-xs text-[#fcd34d]">
          <span className="font-bold">Revision requested:</span> {transaction.revisionReason}
        </div>
      )}
```

- [ ] **Step 6: Render the two new modals**

Change the end of the component from:

```tsx
      {showPostModal && (
        <PostTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={postSubmitting}
          error={postError}
          onCancel={() => setShowPostModal(false)}
          onConfirm={handleTogglePosted}
        />
      )}
    </div>
  );
}
```

to:

```tsx
      {showPostModal && (
        <PostTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={postSubmitting}
          error={postError}
          onCancel={() => setShowPostModal(false)}
          onConfirm={handleTogglePosted}
        />
      )}

      {showApproveModal && (
        <ApproveTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          isFinalLevel={isFinalApprovalLevel}
          submitting={approveSubmitting}
          error={approveError}
          onCancel={() => setShowApproveModal(false)}
          onConfirm={handleConfirmApprove}
        />
      )}

      {showReviseModal && (
        <ReviseTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={reviseSubmitting}
          error={reviseError}
          onCancel={() => setShowReviseModal(false)}
          onConfirm={handleConfirmRevise}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Wire `page.tsx` — compute approval state and pass the new props**

In `app/(authenticated)/transactions/open/[id]/page.tsx`, add this import alongside the existing ones:

```tsx
import { getApprovalState } from "@/lib/transactionApproval";
```

Change:

```tsx
  const matchedApprovers = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const approvers: ApproverRow[] = matchedApprovers.map((row) => ({
    id: row.id,
    level: row.level,
    approverName: `${row.approverFirstName} ${row.approverLastName}`,
    initials: `${row.approverFirstName.charAt(0)}${row.approverLastName.charAt(0)}`.toUpperCase(),
  }));
```

to:

```tsx
  const matchedApprovers = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const approvers: ApproverRow[] = matchedApprovers.map((row) => ({
    id: row.id,
    level: row.level,
    approverName: `${row.approverFirstName} ${row.approverLastName}`,
    initials: `${row.approverFirstName.charAt(0)}${row.approverLastName.charAt(0)}`.toUpperCase(),
  }));

  const approvalState =
    transaction.postedAt !== null && transaction.status.name !== "Cancelled"
      ? await getApprovalState(id)
      : null;
  const pendingApprover = approvalState?.chain.find(
    (approver) => approver.level === approvalState.pendingLevel
  );
  const isPendingApprover = session?.sub === pendingApprover?.approverId;
  const isFinalApprovalLevel =
    !!approvalState &&
    approvalState.chain[approvalState.chain.length - 1]?.level === approvalState.pendingLevel;
```

Change:

```tsx
  const transactionDetail = {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    qrDataUrl: await QRCode.toDataURL(transaction.transactionCode, { width: 240, margin: 1 }),
    matrixTypeName: transaction.matrixType.name,
    statusName: transaction.status.name,
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    postedAt: transaction.postedAt ? transaction.postedAt.toISOString() : null,
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };
```

to:

```tsx
  const transactionDetail = {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    qrDataUrl: await QRCode.toDataURL(transaction.transactionCode, { width: 240, margin: 1 }),
    matrixTypeName: transaction.matrixType.name,
    statusName: transaction.status.name,
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    postedAt: transaction.postedAt ? transaction.postedAt.toISOString() : null,
    revisionReason: transaction.revisionReason,
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };
```

Change:

```tsx
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
          approvers={approvers}
          isOwner={isOwner}
        />
```

to:

```tsx
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
          approvers={approvers}
          isOwner={isOwner}
          isPendingApprover={isPendingApprover}
          isFinalApprovalLevel={isFinalApprovalLevel}
        />
```

The `transaction.findUnique` query's `select`/`include` already fetches everything `revisionReason` and `getApprovalState` need (Prisma includes all scalar columns by default when `include` is used without a narrowing `select` at the top level, and `transaction.postedAt`/`transaction.status.name` are already selected) — no query changes needed beyond what's already there.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests including the new ones.

- [ ] **Step 9: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 10: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/page.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"
git commit -m "Wire Approve/Revise/Cancel actions and the revision-reason banner into the detail page"
```

## Post-plan verification (controller, not a subagent)

After Task 7 is reviewed and committed, live-verify against the running dev server (this plan has a migration in Task 1 — restart the dev server after it runs, per the documented `.next`/stale-Prisma-Client gotchas):

1. As a configured Level 1 approver, open a posted transaction where it's your turn: confirm Approve/Revise/Cancel all render, and no Post/Unpost/Delete owner buttons show even if you're also the creator on some other transaction.
2. Click Approve, confirm in the modal, verify the transaction advances (check via a direct DB query or the List Approvers panel) and the buttons disappear for you afterward.
3. On a transaction with only one configured level, confirm approving it sets `Transaction.status` to `"Approved"` and the copy said "final approval" beforehand.
4. Click Revise on a different posted transaction, type a reason, confirm — verify the transaction becomes unposted, the creator's own detail-page view now shows the revision-reason banner, and the creator can Post again.
5. After that re-post, confirm the same approver (the one who revised) is pending again — not level 1 from scratch, if a lower level had already approved before the revision.
6. Click Cancel as the approver on a still-posted transaction — confirm it cancels directly (no "unpost first" error) and appears on Canceled Transactions.
7. As a Level 2 approver, confirm you cannot act (no visible buttons, and a direct API call returns 403) on a transaction still waiting on Level 1.
8. Confirm a transaction posted under a matrix type with zero configured approvers immediately shows status `"Approved"` after posting, with no approver buttons for anyone.
