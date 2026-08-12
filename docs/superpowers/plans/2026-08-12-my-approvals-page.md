# My Approvals Worklist Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/transactions/my-approvals` as a real worklist (list + detail pages) showing only the transactions where the signed-in user is the current pending-level approver, and relocate the Approve/Revise/Cancel-as-reject actions there exclusively, off the Open Transaction detail page.

**Architecture:** A new `lib/myApprovals.ts` helper filters transactions to "posted, still Open, and this user is the pending approver," reusing the existing `getApprovalState` engine unchanged. Two new thin Next.js route files reuse the existing `TransactionsTable` and `TransactionDetailView` components verbatim (adding one small prop to each for route-awareness), matching how this codebase already reuses those same components across Open/Canceled. The very last task removes the approval-state computation from Open Transaction's own detail page so the actions structurally can't render there anymore.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Prisma + PostgreSQL (local `perso_proj`), Vitest + Testing Library, TypeScript.

## Global Constraints

- Row-level quick-actions (Approve/Revise buttons directly in a table row) are out of scope — actions live only on the detail page.
- `TransactionsTable`'s new `detailBasePath` prop must default to `"/transactions/open"` — Open Transaction and Canceled Transaction must keep navigating exactly as they do today with zero changes to their own call sites.
- `TransactionDetailView`'s new `backHref` prop must default to `"/transactions/open"` for the same reason.
- The candidate query for My Approvals is exactly `postedAt: { not: null }` AND `status.name === "Open"` — no separate cancelled/approved checks are needed; both are already excluded because cancelling and full-approval each change `status.name` away from `"Open"`.
- Both new My Approvals routes gate with `if (!session || !canViewApprovals(session)) redirect("/dashboard")` — the same full-block shape `app/(authenticated)/register/page.tsx` already uses for `canProvisionUsers`, not the Settings read-only-open pattern.
- Post/Unpost and the creator's own Delete/Cancel button are unaffected anywhere in this plan — both stay gated on `isOwner`, unchanged.
- The read-only "List Approvers" panel stays visible on Open Transaction's own detail page after this plan — it is informational, not an action, and is not part of what's being relocated.
- No new npm dependencies.

---

### Task 1: `lib/myApprovals.ts` — pending-approval filtering helper

**Files:**
- Create: `lib/myApprovals.ts`
- Test: `lib/myApprovals.test.ts`

**Interfaces:**
- Consumes: `getApprovalState(transactionId: string): Promise<ApprovalState>` from `lib/transactionApproval.ts` (existing, unchanged) — `ApprovalState = { chain: ScopeMatchedApprover[]; approvedLevels: number[]; pendingLevel: number | null; isFullyApproved: boolean }`, where `ScopeMatchedApprover = { id, level, approverId, approverFirstName, approverLastName }`.
- Produces: `findPendingApprovalTransactionIds(approverId: string): Promise<string[]>` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `lib/myApprovals.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/myApprovals.test.ts`
Expected: FAIL — `lib/myApprovals.ts` does not exist yet (module resolution error).

- [ ] **Step 3: Write the implementation**

Create `lib/myApprovals.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { getApprovalState } from "@/lib/transactionApproval";

export async function findPendingApprovalTransactionIds(
  approverId: string
): Promise<string[]> {
  const candidates = await prisma.transaction.findMany({
    where: { postedAt: { not: null }, status: { name: "Open" } },
    select: { id: true },
  });

  const pendingIds: string[] = [];
  for (const candidate of candidates) {
    const state = await getApprovalState(candidate.id);
    if (state.pendingLevel === null) continue;

    const pendingApprover = state.chain.find(
      (approver) => approver.level === state.pendingLevel
    );
    if (pendingApprover?.approverId === approverId) {
      pendingIds.push(candidate.id);
    }
  }

  return pendingIds;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/myApprovals.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/myApprovals.ts lib/myApprovals.test.ts
git commit -m "Add findPendingApprovalTransactionIds for the My Approvals worklist"
```

---

### Task 2: `TransactionsTable` gains a `detailBasePath` prop

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Test: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TransactionsTable({ rows, showActions?, emptyMessage?, detailBasePath? })` — `detailBasePath` defaults to `"/transactions/open"`. Consumed by Task 4 (My Approvals list page) with `detailBasePath="/transactions/my-approvals"`.

- [ ] **Step 1: Write the failing test**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, add this test directly below the existing `"navigates to the transaction's detail page when a row is clicked"` test (around line 166):

```ts
  it("navigates under a custom detailBasePath when provided", () => {
    render(<TransactionsTable rows={transactions} detailBasePath="/transactions/my-approvals" />);
    fireEvent.click(rowFor("OT-001"));
    expect(pushMock).toHaveBeenCalledWith("/transactions/my-approvals/t1");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx" -t "detailBasePath"`
Expected: FAIL — navigates to `/transactions/open/t1` instead of `/transactions/my-approvals/t1` (prop doesn't exist / is ignored).

- [ ] **Step 3: Implement**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, update the `TransactionsTable` function signature (currently around line 65-73):

```tsx
export function TransactionsTable({
  rows,
  showActions = true,
  emptyMessage = "No open transactions yet.",
  detailBasePath = "/transactions/open",
}: {
  rows: TransactionRow[];
  showActions?: boolean;
  emptyMessage?: string;
  detailBasePath?: string;
}) {
```

Then replace both hardcoded navigation targets inside the row (currently around lines 180 and 185):

```tsx
                  onClick={() => router.push(`${detailBasePath}/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`${detailBasePath}/${row.id}`);
                    }
                  }}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests in this file green (including the pre-existing default-path navigation test, unaffected).

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Add detailBasePath prop to TransactionsTable"
```

---

### Task 3: `TransactionDetailView` gains a `backHref` prop

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Test: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TransactionDetailView({ ..., backHref? })` — `backHref` defaults to `"/transactions/open"`. Consumed by Task 5 (My Approvals detail page) with `backHref="/transactions/my-approvals"`.

- [ ] **Step 1: Write the failing test**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, add near the other rendering tests (after the "renders the header card..." test, using the same `visitorPassTransaction`/`employees` fixtures already defined at the top of the file):

```ts
  it("renders the Back link pointing at /transactions/open by default", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/transactions/open"
    );
  });

  it("renders the Back link pointing at a custom backHref when provided", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        backHref="/transactions/my-approvals"
      />
    );
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/transactions/my-approvals"
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx" -t "Back link"`
Expected: the first case PASSes already (current hardcoded default matches), the second FAILs — the link still points at `/transactions/open` regardless of the `backHref` prop, which doesn't exist yet.

- [ ] **Step 3: Implement**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`, update the component's destructured props (currently around lines 120-138):

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
  backHref = "/transactions/open",
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
  isOwner?: boolean;
  isPendingApprover?: boolean;
  isFinalApprovalLevel?: boolean;
  backHref?: string;
}) {
```

Then update the Back link (currently around line 457):

```tsx
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
      >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests in this file green.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"
git commit -m "Add backHref prop to TransactionDetailView"
```

---

### Task 4: My Approvals list page

**Files:**
- Create: `app/(authenticated)/transactions/my-approvals/page.tsx` (replaces the existing `PagePlaceholder` file of the same path)

**Interfaces:**
- Consumes: `findPendingApprovalTransactionIds(approverId: string): Promise<string[]>` (Task 1), `TransactionsTable({ rows, showActions?, emptyMessage?, detailBasePath? })` (Task 2), `canViewApprovals(user: { department: string; role: Role }): boolean` from `lib/auth/permissions.ts` (existing, unchanged).
- Produces: the `/transactions/my-approvals` route. No other task depends on this file's internals.

This file has no dedicated unit test — no `page.tsx` in this codebase does (server components doing session/Prisma lookups are verified via the full suite plus live/manual checks, not per-file unit tests, matching how `app/(authenticated)/transactions/canceled/page.tsx` and every other list page here work today).

- [ ] **Step 1: Replace the placeholder implementation**

Replace the entire contents of `app/(authenticated)/transactions/my-approvals/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { pageBackground, headingText, mutedText } from "@/lib/deepForest";
import { findPendingApprovalTransactionIds } from "@/lib/myApprovals";
import { TransactionsTable } from "../open/TransactionsView";

export default async function MyApprovalsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canViewApprovals(session)) {
    redirect("/dashboard");
  }

  const pendingIds = await findPendingApprovalTransactionIds(session.sub);

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: pendingIds } },
    orderBy: { createdAt: "desc" },
    include: {
      matrixType: { select: { name: true } },
      status: { select: { name: true } },
      creator: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  });

  const transactionRows = await Promise.all(
    transactions.map(async (row) => ({
      id: row.id,
      transactionCode: row.transactionCode,
      qrDataUrl: await QRCode.toDataURL(row.transactionCode, {
        width: 240,
        margin: 1,
      }),
      matrixTypeName: row.matrixType.name,
      plannedDate: row.plannedDate
        ? row.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
      plannedTime: row.plannedTime
        ? row.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      returnTime: row.returnTime
        ? row.returnTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      originBusinessUnit: row.originBusinessUnit ?? "—",
      enrouteBusinessUnits:
        row.enrouteBusinessUnits.length > 0 ? row.enrouteBusinessUnits.join(", ") : "—",
      reason: row.reason ?? "—",
      visitorType: row.visitorType ?? "—",
      personToMeet: row.personToMeet ?? "—",
      department: row.department?.name ?? "—",
      location: row.visitLocation ?? "—",
      transportType: row.transportType ?? "—",
      plateNo: row.plateNo ?? "—",
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      canManagePosting: false,
    }))
  );

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <div className="mb-4">
          <h1 className={`text-lg ${headingText}`}>My Approvals</h1>
          <p className={`text-xs ${mutedText}`}>Transactions waiting on your approval</p>
        </div>
        <TransactionsTable
          rows={transactionRows}
          showActions={false}
          detailBasePath="/transactions/my-approvals"
          emptyMessage="No transactions waiting on your approval."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: same pass/fail counts as before this task (this file has no dedicated test, and nothing else imports it yet).

- [ ] **Step 3: Run the build to confirm no type errors**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/transactions/my-approvals/page.tsx"
git commit -m "Build the My Approvals worklist list page"
```

---

### Task 5: My Approvals detail page

**Files:**
- Create: `app/(authenticated)/transactions/my-approvals/[id]/page.tsx`

**Interfaces:**
- Consumes: `TransactionDetailView` and its exported types `LineItemRow`/`ApproverRow` from `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx` (Task 3's `backHref` prop), `findScopeMatchedApprovers` from `lib/matchApprovers.ts` (existing, unchanged), `getApprovalState` from `lib/transactionApproval.ts` (existing, unchanged), `canViewApprovals` from `lib/auth/permissions.ts` (existing, unchanged).
- Produces: the `/transactions/my-approvals/[id]` route. This is the only route in the app that computes and passes real `isPendingApprover`/`isFinalApprovalLevel` going forward (Task 6 removes the other one).

Same testing note as Task 4 — no dedicated unit test for this server page component.

- [ ] **Step 1: Create the file**

Create `app/(authenticated)/transactions/my-approvals/[id]/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { pageBackground } from "@/lib/deepForest";
import { findScopeMatchedApprovers } from "@/lib/matchApprovers";
import { getApprovalState } from "@/lib/transactionApproval";
import {
  TransactionDetailView,
  type LineItemRow,
  type ApproverRow,
} from "../../open/[id]/TransactionDetailView";

export default async function MyApprovalTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canViewApprovals(session)) {
    redirect("/dashboard");
  }

  const [transaction, users] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: {
        matrixType: { select: { name: true } },
        status: { select: { name: true } },
        creator: {
          select: {
            firstName: true,
            lastName: true,
            departmentId: true,
            businessUnitId: true,
            locationId: true,
          },
        },
        lineItems: {
          orderBy: { createdAt: "asc" },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                jobTitle: true,
                department: { select: { name: true } },
                businessUnit: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: { select: { name: true } },
        businessUnit: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";
  const isOwner = session.sub === transaction.creatorId;

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
  const isPendingApprover = session.sub === pendingApprover?.approverId;
  const isFinalApprovalLevel =
    !!approvalState &&
    approvalState.chain[approvalState.chain.length - 1]?.level === approvalState.pendingLevel;

  const detailFieldCandidates: { label: string; value: string }[] = [
    {
      label: "Planned Date",
      value: transaction.plannedDate
        ? transaction.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
    },
    {
      label: "Planned Time",
      value: transaction.plannedTime
        ? transaction.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
    },
    { label: "Reason", value: transaction.reason ?? "—" },
  ];

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

  const lineItems: LineItemRow[] = transaction.lineItems.map((item) => ({
    id: item.id,
    variant: isVisitorPass ? "visitor-pass" : "employee",
    visitorName: item.visitorName ?? "",
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    contactNumber: item.contactNumber ?? "",
    emailAddress: item.emailAddress ?? "",
    transportType: item.transportType ?? "",
    plateNo: item.plateNo ?? "",
    uploadFileName: item.uploadFileName ?? "",
    hasFile: Boolean(item.uploadFileUrl),
    employeeType: item.employeeType ?? "",
    employeeId: item.employeeId ?? "",
    employeeName: item.employee
      ? `${item.employee.firstName} ${item.employee.lastName}`
      : (item.name ?? ""),
    jobPosition: item.employee?.jobTitle ?? "—",
    department: item.employee?.department.name ?? "—",
    businessUnit: item.employee?.businessUnit.name ?? "—",
    remarks: item.remarks ?? "",
  }));

  const employees = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    jobPosition: user.jobTitle,
    department: user.department.name,
    businessUnit: user.businessUnit.name,
  }));

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
          approvers={approvers}
          isOwner={isOwner}
          isPendingApprover={isPendingApprover}
          isFinalApprovalLevel={isFinalApprovalLevel}
          backHref="/transactions/my-approvals"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: same pass/fail counts as after Task 4.

- [ ] **Step 3: Run the build to confirm no type errors**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/transactions/my-approvals/[id]/page.tsx"
git commit -m "Build the My Approvals worklist detail page"
```

---

### Task 6: Remove approval actions from the Open Transaction detail page

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is the cutover task. After this task, `TransactionDetailView`'s `isPendingApprover`/`isFinalApprovalLevel` are only ever `true` when rendered from Task 5's route.

This is the final, behavior-changing task — do it last, after Tasks 4-5 give approvers a working replacement path.

- [ ] **Step 1: Remove the now-unused import**

In `app/(authenticated)/transactions/open/[id]/page.tsx`, remove this line (currently around line 8):

```tsx
import { getApprovalState } from "@/lib/transactionApproval";
```

- [ ] **Step 2: Remove the approval-state computation**

Delete this block (currently around lines 85-95, immediately after the `approvers` mapping):

```tsx
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

- [ ] **Step 3: Stop passing the removed props**

In the same file, find the `<TransactionDetailView>` call (currently around lines 172-183) and remove these two lines:

```tsx
          isPendingApprover={isPendingApprover}
          isFinalApprovalLevel={isFinalApprovalLevel}
```

`TransactionDetailView` falls back to its own `isPendingApprover = false` / `isFinalApprovalLevel = false` defaults, so nothing else needs to change — `isOwner` and `approvers` (the List Approvers panel data) stay exactly as they are.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: same pass/fail counts as after Task 5 — this file has no dedicated unit test, and no other test file asserts on Open Transaction's approval-button visibility (those buttons were only ever conditionally rendered via `TransactionDetailView`'s own prop-driven tests, unaffected by this change).

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: clean build, no unused-import lint/type errors.

- [ ] **Step 6: Manually verify against the running dev server**

1. If the dev server hasn't been restarted since any migration this session, restart it first per the documented `.next`/stale-Prisma-Client gotchas (this task touches no schema, so a restart isn't required unless one is already pending from earlier work).
2. Sign in as a user who is currently the pending approver on some posted, `"Open"`-status transaction (or configure one via Settings → Matrix Type → approvers, then post a matching transaction, if no such case exists yet in the local DB).
3. Visit that transaction via `/transactions/open/[id]` — confirm Approve/Revise/Cancel are **not** present (Post/Unpost and the creator's Delete still show correctly if you're also the owner; the List Approvers panel still renders).
4. Visit `/transactions/my-approvals` as that same user — confirm the transaction appears in the table.
5. Click into it (now at `/transactions/my-approvals/[id]`) — confirm Approve/Revise/Cancel **are** present, and the Back button returns to `/transactions/my-approvals`.
6. Sign in as a non-approver (e.g. a Creator-role user) and confirm `/transactions/my-approvals` redirects to `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/page.tsx"
git commit -m "Move approve/revise/cancel off the Open Transaction detail page"
```

---

## Post-plan verification checklist

- [ ] Full suite green at the standard baseline (only the known seed-admin-drift and reference-data-drift failures, nothing new).
- [ ] `npm run build` clean.
- [ ] Live walkthrough per Task 6 Step 6, confirming both the removal (Open Transaction) and the addition (My Approvals) sides of the behavior change.
- [ ] Confirm a transaction disappears from a given approver's My Approvals list the moment they approve it (moves to the next level's approver, or off the list entirely if it was the final level).
