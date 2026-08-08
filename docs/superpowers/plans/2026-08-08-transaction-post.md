# Transaction Post/Unpost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a transaction's creator "Post" it (locking line-item add/edit/delete for everyone) and "Unpost" it (reversing that), with the action available from both the Open Transactions list and the transaction detail page, per `docs/superpowers/specs/2026-08-08-transaction-post-design.md`.

**Architecture:** One new nullable `Transaction.postedAt` column drives everything else — a new `PATCH /api/transactions/[id]` endpoint flips it, the existing line-item routes gain a guard that reads it, and both UI surfaces (list, detail) read it to decide what to render.

**Tech Stack:** Next.js route handlers, Prisma (Postgres), Zod, React client components, Vitest + Testing Library.

## Global Constraints

- Only the transaction's creator may post or unpost it — `403` for anyone else calling `PATCH /api/transactions/[id]`.
- Once posted, line-item add/edit/delete is blocked for **everyone**, including the creator — the line-item routes' `409` guard has no creator exception.
- No change to `Transaction.status`, `TransactionStatus`, or the Open Transactions list's existing `status: "Open"` filter.
- No restriction added to who can add/edit/delete line items on a transaction that is **not** posted — that stays exactly as open as it is today.
- Posting requires `window.confirm(...)` before the request fires; unposting fires immediately, no confirmation.
- When posted, "+ Add Line Item" and the line items table's "Actions" column (header and cells) are removed from the DOM entirely — not CSS-hidden, not disabled.
- A non-creator viewing a posted or unposted transaction never sees a Post/Unpost button, in either the list or the detail page — not even disabled.

---

### Task 1: Schema migration + validation schema

**Files:**
- Modify: `prisma/schema.prisma` (`Transaction` model, around line 149)
- Modify: `lib/validation/transaction.ts`
- Test: `lib/validation/transaction.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Transaction.postedAt` (`DateTime?`, `null` = not posted) on the Prisma client, and `postTransactionSchema` (`z.object({ posted: z.boolean() })`) exported from `lib/validation/transaction.ts` — both are what every later task in this plan builds on.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, find the `Transaction` model's last line before its closing brace:

```prisma
  lineItems TransactionLineItem[]
}
```

Change it to:

```prisma
  lineItems TransactionLineItem[]
  postedAt  DateTime?
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_transaction_posted_at`
Expected: a new folder under `prisma/migrations/` containing `ALTER TABLE "Transaction" ADD COLUMN "postedAt" TIMESTAMP(3);` (additive, nullable — no data loss, no confirmation prompt), applied to the local `perso_proj` database, and the Prisma Client regenerated.

If a `next dev` server is already running, restart it after this step (`Get-Process -Name node | Stop-Process -Force` then `npm run dev`) — a running dev server's in-memory Prisma Client won't pick up the new column otherwise (documented gotcha on this branch).

- [ ] **Step 3: Write the failing test for the new schema**

In `lib/validation/transaction.test.ts`, change the import line from:

```ts
import { transactionSchema } from "./transaction";
```

to:

```ts
import { transactionSchema, postTransactionSchema } from "./transaction";
```

Then append this new `describe` block at the end of the file:

```ts
describe("postTransactionSchema", () => {
  it("accepts { posted: true }", () => {
    const result = postTransactionSchema.safeParse({ posted: true });
    expect(result.success).toBe(true);
  });

  it("accepts { posted: false }", () => {
    const result = postTransactionSchema.safeParse({ posted: false });
    expect(result.success).toBe(true);
  });

  it("rejects a missing posted field", () => {
    const result = postTransactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean posted value", () => {
    const result = postTransactionSchema.safeParse({ posted: "true" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run lib/validation/transaction.test.ts`
Expected: FAIL — `postTransactionSchema` doesn't exist yet (import error).

- [ ] **Step 5: Add the schema**

In `lib/validation/transaction.ts`, append after the closing `});` of `transactionSchema`:

```ts

export const postTransactionSchema = z.object({
  posted: z.boolean(),
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/validation/transaction.test.ts`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/validation/transaction.ts lib/validation/transaction.test.ts
git commit -m "Add Transaction.postedAt column and postTransactionSchema"
```

---

### Task 2: `PATCH /api/transactions/[id]` endpoint

**Files:**
- Create: `app/api/transactions/[id]/route.ts`
- Test: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `postTransactionSchema` from `lib/validation/transaction.ts` (Task 1), `Transaction.postedAt`/`Transaction.creatorId` (Task 1), `verifySessionToken`/`SESSION_COOKIE_NAME` from `@/lib/auth/session` (existing).
- Produces: `PATCH /api/transactions/[id]` — body `{ posted: boolean }` (JSON). Responses: `401` (`{ error: "Not authenticated" }`), `404` (`{ error: "Transaction not found" }`), `403` (`{ error: "Only the creator can post or unpost this transaction" }`), `400` (`{ error: "Invalid request" }`), `200` (`{ postedAt: string | null }`, ISO timestamp or `null`). Tasks 4 and 5 call this endpoint.

- [ ] **Step 1: Write the failing test**

Create `app/api/transactions/[id]/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let creatorToken: string;
let creatorId: string;
let otherUserToken: string;
let matrixTypeId: string;
let transactionId: string;

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/transactions/x", {
    method: "PATCH",
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

describe("PATCH /api/transactions/[id]", () => {
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

    const creator = await prisma.user.upsert({
      where: { email: "transaction-id-route-test-creator@example.com" },
      update: {},
      create: {
        firstName: "Post",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transaction-id-route-test-creator@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    creatorId = creator.id;

    creatorToken = await createSessionToken({
      sub: creator.id,
      email: creator.email,
      firstName: creator.firstName,
      lastName: creator.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    const otherUser = await prisma.user.upsert({
      where: { email: "transaction-id-route-test-other@example.com" },
      update: {},
      create: {
        firstName: "Other",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transaction-id-route-test-other@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });

    otherUserToken = await createSessionToken({
      sub: otherUser.id,
      email: otherUser.email,
      firstName: otherUser.firstName,
      lastName: otherUser.lastName,
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
      where: { name: "Transaction ID Route Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-TXNIDROUTEFIXTURE",
        name: "Transaction ID Route Fixture Matrix Type",
        creatorId,
      },
    });
    matrixTypeId = matrixType.id;

    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDROUTE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    transactionId = transaction.id;
  });

  it("returns 401 with no session", async () => {
    const response = await PATCH(
      requestWithCookie(undefined, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns 403 when a non-creator tries to post it", async () => {
    const response = await PATCH(
      requestWithCookie(otherUserToken, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Only the creator can post or unpost this transaction");
  });

  it("returns 400 for an invalid body", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: "yes" }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(400);
  });

  it("posts the transaction, setting postedAt", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.postedAt).not.toBeNull();

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    expect(stored.postedAt).not.toBeNull();
  });

  it("unposts the transaction, clearing postedAt", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: false }),
      paramsFor(transactionId)
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.postedAt).toBeNull();

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    expect(stored.postedAt).toBeNull();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: transactionId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/transactions/\[id\]/route.test.ts`
Expected: FAIL — `./route` doesn't exist yet.

- [ ] **Step 3: Write the route**

Create `app/api/transactions/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { postTransactionSchema } from "@/lib/validation/transaction";

export async function PATCH(
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
    select: { creatorId: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.creatorId !== session.sub) {
    return NextResponse.json(
      { error: "Only the creator can post or unpost this transaction" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = postTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { postedAt: parsed.data.posted ? new Date() : null },
    select: { postedAt: true },
  });

  return NextResponse.json(
    { postedAt: updated.postedAt ? updated.postedAt.toISOString() : null },
    { status: 200 }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/transactions/\[id\]/route.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/api/transactions/[id]/route.ts" "app/api/transactions/[id]/route.test.ts"
git commit -m "Add PATCH /api/transactions/[id] to post/unpost a transaction"
```

---

### Task 3: Lock line-item routes on a posted transaction

**Files:**
- Modify: `app/api/transactions/[id]/line-items/route.ts:31-38`
- Modify: `app/api/transactions/[id]/line-items/[lineItemId]/route.ts:31-43,151-176`
- Test: `app/api/transactions/[id]/line-items/route.test.ts`
- Test: `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`

**Interfaces:**
- Consumes: `Transaction.postedAt` from Task 1 (reads it directly via Prisma; does not call the Task 2 endpoint).
- Produces: all three line-item handlers (`POST`, `PATCH`, `DELETE`) now return `409` with `{ error: "Cannot modify line items on a posted transaction." }` when the parent transaction is posted. Nothing downstream in this plan depends on this task, but it is a Global Constraint every reviewer will check for.

- [ ] **Step 1: Write the failing tests**

In `app/api/transactions/[id]/line-items/route.test.ts`, add a new module-level variable near the top (alongside the existing `let` declarations):

```ts
let postedTransactionId: string;
```

In `beforeAll`, immediately after the `employeeTransaction` block (after `employeeTransactionId = employeeTransaction.id;`), add:

```ts
    const postedTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIPOSTED",
        matrixTypeId: employeeMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
        postedAt: new Date(),
      },
    });
    postedTransactionId = postedTransaction.id;
```

Add this test (anywhere after the `beforeAll`/before `afterAll`, e.g. right after the "returns 404 for a nonexistent transaction id" test):

```ts
  it("returns 409 when the transaction is already posted", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Should Not Be Created");
    body.set("remarks", "X");

    const response = await POST(
      requestWithCookie(userToken, postedTransactionId, body),
      paramsFor(postedTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a posted transaction.");
  });
```

In `afterAll`, change:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [visitorPassTransactionId, employeeTransactionId] } },
    });
```

to:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [visitorPassTransactionId, employeeTransactionId, postedTransactionId] } },
    });
```

In `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`, add a new module-level variable near the top:

```ts
let postedTransactionId: string;
```

In `beforeAll`, immediately after the `visitorPassTransactionId = visitorPassTransaction.id;` line, add:

```ts
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
```

Add these two tests (anywhere after `beforeAll`/before `afterAll`):

```ts
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
```

In that same file's `afterAll`, change:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [transactionId, visitorPassTransactionId] } },
    });
```

to:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [transactionId, visitorPassTransactionId, postedTransactionId] } },
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/line-items/route.test.ts" "app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts"`
Expected: FAIL — the three new `409` tests currently get `201`/`200`/`204` since no guard exists yet.

- [ ] **Step 3: Add the guard to `line-items/route.ts` (POST)**

In `app/api/transactions/[id]/line-items/route.ts`, change:

```ts
  const { id: transactionId } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { matrixType: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
```

to:

```ts
  const { id: transactionId } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { postedAt: true, matrixType: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }
```

- [ ] **Step 4: Add the guard to `line-items/[lineItemId]/route.ts` (PATCH)**

In `app/api/transactions/[id]/line-items/[lineItemId]/route.ts`, in the `PATCH` function, change:

```ts
  if (existing.transactionId !== transactionId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const formData = await request.formData();
```

to:

```ts
  if (existing.transactionId !== transactionId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  const formData = await request.formData();
```

(`existing.transaction.postedAt` is already available here without changing the query — the existing `include: { transaction: { include: { matrixType: { select: { name: true } } } } }` returns every scalar on `Transaction`, `postedAt` included, since `include` isn't exclusive the way `select` is.)

- [ ] **Step 5: Add the guard to `line-items/[lineItemId]/route.ts` (DELETE)**

In the same file's `DELETE` function, change:

```ts
  const { id: transactionId, lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileUrl: true, transactionId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  if (existing.transactionId !== transactionId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  await prisma.transactionLineItem.delete({ where: { id: lineItemId } });
```

to:

```ts
  const { id: transactionId, lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: {
      uploadFileUrl: true,
      transactionId: true,
      transaction: { select: { postedAt: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  if (existing.transactionId !== transactionId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  await prisma.transactionLineItem.delete({ where: { id: lineItemId } });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run "app/api/transactions/[id]/line-items/route.test.ts" "app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts"`
Expected: PASS, all tests in both files (existing + 3 new).

- [ ] **Step 7: Run the full suite to check for collateral breakage**

Run: `npx vitest run`
Expected: same pre-existing baseline as always (the two known `prisma/seed.test.ts` failures — seed-admin drift and reference-data drift), nothing else new.

- [ ] **Step 8: Commit**

```bash
git add "app/api/transactions/[id]/line-items/route.ts" "app/api/transactions/[id]/line-items/route.test.ts" "app/api/transactions/[id]/line-items/[lineItemId]/route.ts" "app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts"
git commit -m "Return 409 from line-item routes when the transaction is posted"
```

---

### Task 4: Detail page — Post/Unpost button, badge, and locked Actions column

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx`
- Test: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/transactions/[id]` from Task 2 (`{ posted: boolean }` body, `200`/`403`/`404`/`400` with `{ error }` on failure).
- Produces: `TransactionDetailData` gains `postedAt: string | null`; `TransactionDetailView` gains an `isOwner?: boolean` prop (default `false`) — no other file in this plan consumes these, but they're the shape Task 5's own list-page work should stay consistent with if it ever shares a type (it doesn't; each view keeps its own row/detail type, per this app's established per-component convention).

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, change the `visitorPassTransaction` fixture (near the top of the file) from:

```ts
const visitorPassTransaction = {
  id: "t1",
  transactionCode: "OT-001",
  qrDataUrl: "data:image/png;base64,mockqrdata",
  matrixTypeName: "Visitor Pass",
  statusName: "Open",
  createdBy: "Jhon Caser",
  createdAt: "Jul 28, 2026",
  detailFields: [{ label: "Reason", value: "Client meeting" }],
};
```

to:

```ts
const visitorPassTransaction = {
  id: "t1",
  transactionCode: "OT-001",
  qrDataUrl: "data:image/png;base64,mockqrdata",
  matrixTypeName: "Visitor Pass",
  statusName: "Open",
  createdBy: "Jhon Caser",
  createdAt: "Jul 28, 2026",
  postedAt: null,
  detailFields: [{ label: "Reason", value: "Client meeting" }],
};
```

(`otherTransaction` spreads `...visitorPassTransaction`, so it inherits `postedAt: null` automatically — no separate edit needed there.)

Append this new `describe` block at the very end of the file (after the final closing `});` of `describe("TransactionDetailView", ...)`):

```ts
describe("TransactionDetailView — Post/Unpost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ postedAt: null }) })));
  });

  it("does not render a Post button for a non-owner", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
  });

  it("renders a Post button for the owner when not posted, and confirms before posting", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(confirmSpy).toHaveBeenCalledWith(
      "Post this transaction? You won't be able to add, edit, or delete line items until you unpost it."
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: true }) })
      )
    );
    confirmSpy.mockRestore();
  });

  it("does not post when the confirm dialog is dismissed", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(fetch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows a POSTED badge and hides + Add Line Item and the Actions column once posted, for every viewer", () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("POSTED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });

  it("renders an Unpost button for the owner when posted, with no confirm dialog", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^unpost$/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: false }) })
      )
    );
    confirmSpy.mockRestore();
  });

  it("shows an inline error when the PATCH request fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ error: "Only the creator can post or unpost this transaction" }),
        })
      )
    );
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /only the creator can post or unpost this transaction/i
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: FAIL — no Post/Unpost button, no badge, no `isOwner` prop exist yet.

- [ ] **Step 3: Update the type and props**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`, change:

```ts
export type TransactionDetailData = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  statusName: string;
  createdBy: string;
  createdAt: string;
  detailFields: { label: string; value: string }[];
};
```

to:

```ts
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

Change the component signature from:

```tsx
export function TransactionDetailView({
  transaction,
  lineItems,
  employees,
  remarksDefault,
  approvers = [],
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const columns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;
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
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const isPosted = transaction.postedAt !== null;
  const baseColumns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;
  const columns = isPosted ? baseColumns.filter((column) => column !== "Actions") : baseColumns;
```

- [ ] **Step 4: Add the post/unpost handler**

In the same file, immediately after the existing `handleConfirmDelete` function (right before the `return (` that starts the JSX), add:

```tsx
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState("");

  async function handleTogglePosted() {
    if (!isPosted) {
      const confirmed = window.confirm(
        "Post this transaction? You won't be able to add, edit, or delete line items until you unpost it."
      );
      if (!confirmed) return;
    }

    setPostError("");
    setPostSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: !isPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError(data.error ?? "Something went wrong");
        setPostSubmitting(false);
        return;
      }

      setPostSubmitting(false);
      router.refresh();
    } catch {
      setPostError("An error occurred while updating the transaction");
      setPostSubmitting(false);
    }
  }
```

- [ ] **Step 5: Add the POSTED badge to the header card**

Change:

```tsx
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
              Status
            </p>
            <p className="text-sm text-[#eafbe4]">{transaction.statusName}</p>
          </div>
```

to:

```tsx
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
              Status
            </p>
            <p className="flex items-center gap-2 text-sm text-[#eafbe4]">
              {transaction.statusName}
              {isPosted && <span className={pillClass("green")}>POSTED</span>}
            </p>
          </div>
```

- [ ] **Step 6: Wire the Post/Unpost and Add Line Item buttons**

Change:

```tsx
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-outfit text-sm font-bold text-white">
          {isVisitorPass ? "Visitor Lists" : "Employee/Visitor Lists"}{" "}
          <span className="font-normal text-[#6f8a68]">({lineItems.length})</span>
        </h2>
        <button
          type="button"
          onClick={openCreateModal}
          className={`${buttonPrimary} px-5 py-2 text-xs`}
        >
          + Add Line Item
        </button>
      </div>
```

to:

```tsx
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-outfit text-sm font-bold text-white">
          {isVisitorPass ? "Visitor Lists" : "Employee/Visitor Lists"}{" "}
          <span className="font-normal text-[#6f8a68]">({lineItems.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={handleTogglePosted}
              disabled={postSubmitting}
              className={`${isPosted ? buttonSecondary : buttonPrimary} px-5 py-2 text-xs`}
            >
              {postSubmitting ? "Saving…" : isPosted ? "UNPOST" : "POST"}
            </button>
          )}
          {!isPosted && (
            <button
              type="button"
              onClick={openCreateModal}
              className={`${buttonPrimary} px-5 py-2 text-xs`}
            >
              + Add Line Item
            </button>
          )}
        </div>
      </div>
      {postError && (
        <p role="alert" className="mb-3 text-xs text-red-400">
          {postError}
        </p>
      )}
```

- [ ] **Step 7: Remove the Actions cell when posted**

Change:

```tsx
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openEditModal(item)}
                      className="mr-2 inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-[#7be36f] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openDeleteModal(item)}
                      className="inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-red-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      🗑️
                    </button>
                  </td>
```

to:

```tsx
                  {!isPosted && (
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        title="Edit"
                        aria-label={`Edit ${isVisitorPass ? item.visitorName : item.employeeName}`}
                        onClick={() => openEditModal(item)}
                        className="mr-2 inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-[#7be36f] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                        onClick={() => openDeleteModal(item)}
                        className="inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-red-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
```

- [ ] **Step 8: Run the component tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests including the 6 new ones.

- [ ] **Step 9: Wire `page.tsx`**

In `app/(authenticated)/transactions/open/[id]/page.tsx`, change the imports from:

```tsx
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { pageBackground } from "@/lib/deepForest";
import { findScopeMatchedApprovers } from "@/lib/matchApprovers";
import { TransactionDetailView, type LineItemRow, type ApproverRow } from "./TransactionDetailView";
```

to:

```tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { pageBackground } from "@/lib/deepForest";
import { findScopeMatchedApprovers } from "@/lib/matchApprovers";
import { TransactionDetailView, type LineItemRow, type ApproverRow } from "./TransactionDetailView";
```

Change:

```tsx
  const { id } = await params;

  const [transaction, users] = await Promise.all([
```

to:

```tsx
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const [transaction, users] = await Promise.all([
```

Change:

```tsx
  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";
```

to:

```tsx
  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";
  const isOwner = session?.sub === transaction.creatorId;
```

Change:

```tsx
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };
```

to:

```tsx
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    postedAt: transaction.postedAt ? transaction.postedAt.toISOString() : null,
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
        />
```

(`transaction.creatorId` and `transaction.postedAt` are already available on the query result without any `include`/`select` change — the existing `prisma.transaction.findUnique({ include: {...} })` call returns every scalar column on `Transaction` by default; only relations need explicit `include`/`select`.)

- [ ] **Step 10: Run the full suite**

Run: `npx vitest run`
Expected: same pre-existing 2-failure baseline (`prisma/seed.test.ts`), nothing else new. Also run `npm run build` to confirm the type changes compile cleanly.

- [ ] **Step 11: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/page.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"
git commit -m "Add Post/Unpost to the transaction detail page"
```

---

### Task 5: Open Transactions list — Actions column

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx:17-37,61-135`
- Modify: `app/(authenticated)/transactions/open/page.tsx`
- Test: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/transactions/[id]` from Task 2 (same contract as Task 4).
- Produces: `TransactionRow` gains `postedAt: string | null` and `canManagePosting: boolean`. Nothing downstream in this plan consumes this — it's the last task.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, change the `transactions` fixture's single row from:

```ts
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
```

to:

```ts
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
    postedAt: null,
    canManagePosting: true,
  },
];
```

Change the `renderView` helper from:

```ts
function renderView(currentUserBusinessUnit = "") {
  return render(
    <TransactionsView
      transactions={transactions}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
      departments={departments}
      businessUnits={businessUnits}
    />
  );
}
```

to:

```ts
function renderView(currentUserBusinessUnit = "", rows = transactions) {
  return render(
    <TransactionsView
      transactions={rows}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
      departments={departments}
      businessUnits={businessUnits}
    />
  );
}
```

Change the existing column-count test from:

```ts
  it("renders the transactions table with the 6 core columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });
```

to:

```ts
  it("renders the transactions table with the 7 core columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
      "Actions",
    ]);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });
```

Append this new `describe` block at the end of the file:

```ts
describe("TransactionsView — Post/Unpost", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ postedAt: null }) }))
    );
  });

  it("shows a Post button when the current user created the transaction and it isn't posted", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    expect(
      within(rowFor("OT-001")).getByRole("button", { name: /^post$/i })
    ).toBeInTheDocument();
  });

  it("shows a dash instead of a button when the current user didn't create the transaction", () => {
    renderView("", [{ ...transactions[0], canManagePosting: false, postedAt: null }]);
    expect(
      within(rowFor("OT-001")).queryByRole("button", { name: /^post$|^unpost$/i })
    ).not.toBeInTheDocument();
    expect(within(rowFor("OT-001")).getByText("—")).toBeInTheDocument();
  });

  it("shows an Unpost button and a POSTED badge when already posted", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    const row = rowFor("OT-001");
    expect(within(row).getByRole("button", { name: /^unpost$/i })).toBeInTheDocument();
    expect(within(row).getByText("POSTED")).toBeInTheDocument();
  });

  it("posting requires confirmation and does not navigate the row", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^post$/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("unposting does not show a confirm dialog", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^unpost$/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("calls the PATCH endpoint with the transaction id and posted flag", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^post$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: true }) })
      )
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — no Actions column, no Post/Unpost button, no POSTED badge exist yet.

- [ ] **Step 3: Update the `TransactionRow` type and columns array**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, change:

```ts
export type TransactionRow = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  plannedDate: string;
  plannedTime: string;
  returnTime: string;
  originBusinessUnit: string;
  enrouteBusinessUnits: string;
  reason: string;
  visitorType: string;
  personToMeet: string;
  department: string;
  location: string;
  transportType: string;
  plateNo: string;
  createdBy: string;
  statusName: string;
  createdAt: string;
};
```

to:

```ts
export type TransactionRow = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  plannedDate: string;
  plannedTime: string;
  returnTime: string;
  originBusinessUnit: string;
  enrouteBusinessUnits: string;
  reason: string;
  visitorType: string;
  personToMeet: string;
  department: string;
  location: string;
  transportType: string;
  plateNo: string;
  createdBy: string;
  statusName: string;
  createdAt: string;
  postedAt: string | null;
  canManagePosting: boolean;
};
```

Change:

```ts
function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter();
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
```

to:

```ts
function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter();
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed", "Actions"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<{ id: string; message: string } | null>(null);

  async function handleTogglePosted(row: TransactionRow) {
    const nextPosted = row.postedAt === null;
    if (nextPosted) {
      const confirmed = window.confirm(
        "Post this transaction? You won't be able to add, edit, or delete line items until you unpost it."
      );
      if (!confirmed) return;
    }

    setPostError(null);
    setPostingId(row.id);
    try {
      const response = await fetch(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: nextPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError({ id: row.id, message: data.error ?? "Something went wrong" });
        setPostingId(null);
        return;
      }

      setPostingId(null);
      router.refresh();
    } catch {
      setPostError({ id: row.id, message: "An error occurred while updating the transaction" });
      setPostingId(null);
    }
  }
```

- [ ] **Step 4: Add the badge and the Actions cell**

Change:

```tsx
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={pillClass("slate")}>{row.statusName}</span>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 ${mutedText}`}>{row.createdAt}</td>
                </RevealRow>
```

to:

```tsx
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={pillClass("slate")}>{row.statusName}</span>
                    {row.postedAt && <span className={`ml-2 ${pillClass("green")}`}>POSTED</span>}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 ${mutedText}`}>{row.createdAt}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {row.canManagePosting ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleTogglePosted(row);
                        }}
                        disabled={postingId === row.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none disabled:opacity-60"
                      >
                        {postingId === row.id ? "Saving…" : row.postedAt ? "Unpost" : "Post"}
                      </button>
                    ) : (
                      <span className={mutedText}>—</span>
                    )}
                    {postError?.id === row.id && (
                      <p role="alert" className="mt-1 text-[10px] text-red-400">
                        {postError.message}
                      </p>
                    )}
                  </td>
                </RevealRow>
```

- [ ] **Step 5: Run the component tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests including the 6 new ones and the updated column-count test.

- [ ] **Step 6: Wire `page.tsx`**

In `app/(authenticated)/transactions/open/page.tsx`, change:

```ts
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
  );
```

to:

```ts
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      canManagePosting: session?.sub === row.creatorId,
    }))
  );
```

(`row.postedAt` and `row.creatorId` are already available on each result without changing the `prisma.transaction.findMany` query — it uses `include`, not `select`, so every scalar column is already returned; `session` is already in scope in this file from the existing `currentUserBusinessUnit` lookup.)

- [ ] **Step 7: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing 2-failure baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/page.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Add Post/Unpost Actions column to the Open Transactions list"
```

## Post-plan verification (controller, not a subagent)

After Task 5 is reviewed and committed, live-verify against the running dev server (restart it first if a migration ran mid-session and it's stale):

1. As the creator of an existing Open Transaction: post it from the list, confirm the dialog, watch the row show "POSTED" + an "Unpost" button.
2. Open that transaction's detail page: confirm the POSTED badge, no "+ Add Line Item", no Actions column on the line items table, and an UNPOST button.
3. Click UNPOST (no confirm dialog expected) and confirm the transaction reverts to fully editable, in both the list and detail page.
4. Log in as (or otherwise view as) a different user and confirm that user sees no Post/Unpost button on a transaction they didn't create, in either the list or the detail page — just the badge once posted.
5. Confirm a direct API call attempting to add/edit/delete a line item on a posted transaction gets `409` (can reuse the existing dev-server + one-off script pattern already established on this branch for this kind of spot check).
