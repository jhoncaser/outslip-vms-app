# Transaction Cancel (Soft Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a transaction's creator permanently cancel it (soft delete — status changes to "Cancelled", the row is never removed), moving it from Open Transactions to a real Canceled Transaction page, per `docs/superpowers/specs/2026-08-08-transaction-cancel-design.md`.

**Architecture:** A new `"Cancelled"` `TransactionStatus` row drives everything — a new `DELETE /api/transactions/[id]` endpoint transitions to it, the existing Post/Unpost endpoint and the line-item routes gain defense-in-depth checks against it, a shared confirmation modal is used from both the list and detail page, and the Canceled Transaction page reuses the Open Transactions table component directly.

**Tech Stack:** Next.js route handlers, Prisma (Postgres), React client components, Vitest + Testing Library.

## Global Constraints

- Cancelling is a `Transaction.statusId` transition to a `"Cancelled"` `TransactionStatus` row — no new columns, no change to `Transaction.postedAt`'s own semantics.
- Only the transaction's creator may cancel it — same `session.sub === transaction.creatorId` gate already used for Post/Unpost.
- **Not restorable.** No "Undo"/"Restore" action exists anywhere in this plan.
- Cancelling is blocked (`409`) while a transaction is posted ("unpost first"), and blocked (`409`) if it's already cancelled.
- Cancelling locks a transaction exactly the way posting already does: `isLocked = isPosted || isCancelled`. Once locked, "+ Add Line Item", the line items table's Actions column, and (once cancelled specifically) the Post/Unpost and Delete buttons all disappear — genuine JSX conditionals, not CSS-hidden or disabled.
- The existing Post/Unpost `PATCH` endpoint also rejects (`409`, `"This transaction is cancelled."`) when the transaction is already cancelled — it predates the Cancelled concept and needs this added.
- The line-item routes' existing `409` guard (for posted transactions) gets a **separate**, independent `409` check for cancelled transactions with its own message (`"Cannot modify line items on a cancelled transaction."`) — the existing posted-transaction message and its already-shipped tests are not touched or reused for this.
- The Canceled Transaction page shows the exact same columns/style as Open Transactions, with no Actions column and no "+ Add Transaction" button — achieved by exporting the existing table-rendering component with a new `showActions` boolean prop (default `true`, so Open Transactions' own behavior is unaffected).

---

### Task 1: Seed "Cancelled" status

**Files:**
- Modify: `prisma/seed.ts:18`
- Modify: `prisma/seed.test.ts:88-93`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `"Cancelled"` row in `TransactionStatus` once `main()` (the seed script) runs — every later task's tests independently `upsert` their own `"Cancelled"` row too (matching this codebase's established test convention of not depending on `main()` having run against the test database), so this task is really about the **live dev database** and keeping `prisma/seed.test.ts` accurate, not a hard dependency for later tasks' tests.

- [ ] **Step 1: Write the failing test**

In `prisma/seed.test.ts`, change:

```ts
  it("seeds the Open transaction status", async () => {
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses.map((s) => s.name)).toEqual(["Open"]);
  });
```

to:

```ts
  it("seeds the Open and Cancelled transaction statuses", async () => {
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses.map((s) => s.name)).toEqual(["Open", "Cancelled"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run prisma/seed.test.ts -t "seeds the Open and Cancelled"`
Expected: FAIL — `TRANSACTION_STATUSES` only has `"Open"` so far, actual result is `["Open"]`, not `["Open", "Cancelled"]`.

- [ ] **Step 3: Add "Cancelled" to the seed array**

In `prisma/seed.ts`, change:

```ts
const TRANSACTION_STATUSES = ["Open"];
```

to:

```ts
const TRANSACTION_STATUSES = ["Open", "Cancelled"];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run prisma/seed.test.ts`
Expected: PASS, all tests in this file including the renamed one.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/seed.test.ts
git commit -m "Seed a Cancelled transaction status"
```

---

### Task 2: `DELETE /api/transactions/[id]` + Post/Unpost cancelled-check

**Files:**
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this task's own tests independently `upsert` a `"Cancelled"` `TransactionStatus` row, matching the existing test file's pattern of upserting `"Open"` itself rather than relying on `main()`).
- Produces: `DELETE /api/transactions/[id]` — no request body. Responses: `401` (`{ error: "Not authenticated" }`), `404` (`{ error: "Transaction not found" }`), `403` (`{ error: "Only the creator can delete this transaction" }`), `409` (`{ error: "Unpost this transaction before deleting it." }`) if posted, `409` (`{ error: "Transaction is already cancelled." }`) if already cancelled, `204` No Content on success. Also: the existing `PATCH` handler gains a new `409` (`{ error: "This transaction is cancelled." }`) when the transaction is already cancelled. Tasks 5 and 6 call `DELETE` on this same endpoint.

- [ ] **Step 1: Write the failing tests**

In `app/api/transactions/[id]/route.test.ts`, change the import line from:

```ts
import { PATCH } from "./route";
```

to:

```ts
import { PATCH, DELETE } from "./route";
```

Add new module-level `let` declarations alongside the existing ones:

```ts
let deleteTransactionId: string;
let postedForDeleteTransactionId: string;
let cancelledTransactionId: string;
```

Add this helper function alongside `requestWithCookie`/`paramsFor`:

```ts
function deleteRequestWithCookie(token: string | undefined) {
  return new NextRequest("http://localhost/api/transactions/x", {
    method: "DELETE",
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}
```

In `beforeAll`, immediately after the existing `transactionId = transaction.id;` line, add:

```ts
    await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" },
      update: {},
      create: { name: "Cancelled" },
    });
    const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Cancelled" },
    });

    const deleteTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDDELETE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
      },
    });
    deleteTransactionId = deleteTransaction.id;

    const postedForDeleteTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDDELETEPOSTED",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId,
        postedAt: new Date(),
      },
    });
    postedForDeleteTransactionId = postedForDeleteTransaction.id;

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-TXNIDCANCELLED",
        matrixTypeId,
        statusId: cancelledStatus.id,
        creatorId,
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
```

Add these tests after the existing "unposts the transaction, clearing postedAt" test (before `afterAll`):

```ts
  it("returns 409 when trying to post/unpost an already-cancelled transaction", async () => {
    const response = await PATCH(
      requestWithCookie(creatorToken, { posted: true }),
      paramsFor(cancelledTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("This transaction is cancelled.");
  });

  it("DELETE returns 401 with no session", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(undefined),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("DELETE returns 404 for a nonexistent transaction id", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("DELETE returns 403 when a non-creator tries to delete it", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(otherUserToken),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Only the creator can delete this transaction");
  });

  it("DELETE returns 409 when the transaction is posted", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(postedForDeleteTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Unpost this transaction before deleting it.");
  });

  it("DELETE returns 409 when the transaction is already cancelled", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(cancelledTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Transaction is already cancelled.");
  });

  it("DELETE cancels the transaction, setting status to Cancelled", async () => {
    const response = await DELETE(
      deleteRequestWithCookie(creatorToken),
      paramsFor(deleteTransactionId)
    );
    expect(response.status).toBe(204);

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: deleteTransactionId },
      include: { status: true },
    });
    expect(stored.status.name).toBe("Cancelled");
    expect(stored.postedAt).toBeNull();
  });
```

Change `afterAll` from:

```ts
  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: transactionId } });
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
          ],
        },
      },
    });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/route.test.ts"`
Expected: FAIL — `DELETE` isn't exported from `./route` yet (import error), and the new cancelled-check test gets `200` instead of `409`.

- [ ] **Step 3: Add the cancelled-check to the PATCH handler**

In `app/api/transactions/[id]/route.ts`, change:

```ts
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
```

to:

```ts
  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { creatorId: true, status: { select: { name: true } } },
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

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "This transaction is cancelled." },
      { status: 409 }
    );
  }

  const body = await request.json();
```

- [ ] **Step 4: Add the `DELETE` handler**

At the end of `app/api/transactions/[id]/route.ts`, append:

```ts

export async function DELETE(
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
    select: { creatorId: true, postedAt: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

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

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Transaction is already cancelled." },
      { status: 409 }
    );
  }

  const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
    where: { name: "Cancelled" },
  });

  await prisma.transaction.update({
    where: { id },
    data: { statusId: cancelledStatus.id },
  });

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run "app/api/transactions/[id]/route.test.ts"`
Expected: PASS, all tests (existing + new).

- [ ] **Step 6: Commit**

```bash
git add "app/api/transactions/[id]/route.ts" "app/api/transactions/[id]/route.test.ts"
git commit -m "Add DELETE /api/transactions/[id] to cancel a transaction"
```

---

### Task 3: Lock line-item routes on a cancelled transaction

**Files:**
- Modify: `app/api/transactions/[id]/line-items/route.ts`
- Modify: `app/api/transactions/[id]/line-items/route.test.ts`
- Modify: `app/api/transactions/[id]/line-items/[lineItemId]/route.ts`
- Modify: `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`

**Interfaces:**
- Consumes: nothing from Task 2 (reads `Transaction.status` directly via Prisma, independent of the `DELETE` endpoint).
- Produces: all three line-item handlers (`POST`, `PATCH`, `DELETE`) now also return `409` with `{ error: "Cannot modify line items on a cancelled transaction." }` when the parent transaction is cancelled — a message kept fully separate from the existing posted-transaction `409` message and its already-shipped tests.

- [ ] **Step 1: Write the failing tests**

In `app/api/transactions/[id]/line-items/route.test.ts`, add a new module-level variable near the top:

```ts
let cancelledTransactionId: string;
```

In `beforeAll`, immediately after the `postedTransactionId = postedTransaction.id;` line, add:

```ts
    await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" },
      update: {},
      create: { name: "Cancelled" },
    });
    const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Cancelled" },
    });

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LICANCELLED",
        matrixTypeId: employeeMatrixTypeId,
        statusId: cancelledStatus.id,
        creatorId: userId,
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
```

Add this test (anywhere after `beforeAll`/before `afterAll`):

```ts
  it("returns 409 when the transaction is cancelled", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Should Not Be Created");
    body.set("remarks", "X");

    const response = await POST(
      requestWithCookie(userToken, cancelledTransactionId, body),
      paramsFor(cancelledTransactionId)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a cancelled transaction.");
  });
```

Change `afterAll`'s transaction cleanup from:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [visitorPassTransactionId, employeeTransactionId, postedTransactionId] } },
    });
```

to:

```ts
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [
            visitorPassTransactionId,
            employeeTransactionId,
            postedTransactionId,
            cancelledTransactionId,
          ],
        },
      },
    });
```

In `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`, add a new module-level variable near the top:

```ts
let cancelledTransactionId: string;
```

In `beforeAll`, immediately after the `postedTransactionId = postedTransaction.id;` line, add:

```ts
    await prisma.transactionStatus.upsert({
      where: { name: "Cancelled" },
      update: {},
      create: { name: "Cancelled" },
    });
    const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Cancelled" },
    });

    const cancelledTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-IDCANCELLED",
        matrixTypeId,
        statusId: cancelledStatus.id,
        creatorId: userId,
      },
    });
    cancelledTransactionId = cancelledTransaction.id;
```

Add these two tests (anywhere after `beforeAll`/before `afterAll`):

```ts
  it("returns 409 when PATCHing a line item on a cancelled transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: cancelledTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Should Not Update");
    body.set("remarks", "X");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(cancelledTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a cancelled transaction.");
  });

  it("returns 409 when DELETEing a line item on a cancelled transaction", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId: cancelledTransactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await DELETE(
      requestWithCookie("DELETE", userToken, new FormData()),
      paramsFor(cancelledTransactionId, lineItem.id)
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("Cannot modify line items on a cancelled transaction.");

    const stillThere = await prisma.transactionLineItem.findUnique({ where: { id: lineItem.id } });
    expect(stillThere).not.toBeNull();
  });
```

Change that file's `afterAll` cleanup from:

```ts
    await prisma.transaction.deleteMany({
      where: { id: { in: [transactionId, visitorPassTransactionId, postedTransactionId] } },
    });
```

to:

```ts
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [transactionId, visitorPassTransactionId, postedTransactionId, cancelledTransactionId],
        },
      },
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/transactions/[id]/line-items/route.test.ts" "app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts"`
Expected: FAIL — the three new `409` tests currently get `201`/`200`/`204` since no cancelled-check exists yet.

- [ ] **Step 3: Add the guard to `line-items/route.ts` (POST)**

Change:

```ts
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

to:

```ts
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      postedAt: true,
      status: { select: { name: true } },
      matrixType: { select: { name: true } },
    },
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

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Cannot modify line items on a cancelled transaction." },
      { status: 409 }
    );
  }
```

- [ ] **Step 4: Add the guard to `line-items/[lineItemId]/route.ts` (PATCH)**

Change:

```ts
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    include: { transaction: { include: { matrixType: { select: { name: true } } } } },
  });
```

to:

```ts
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    include: {
      transaction: {
        include: {
          matrixType: { select: { name: true } },
          status: { select: { name: true } },
        },
      },
    },
  });
```

Then change:

```ts
  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  const formData = await request.formData();
```

to:

```ts
  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  if (existing.transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Cannot modify line items on a cancelled transaction." },
      { status: 409 }
    );
  }

  const formData = await request.formData();
```

- [ ] **Step 5: Add the guard to `line-items/[lineItemId]/route.ts` (DELETE)**

Change:

```ts
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: {
      uploadFileUrl: true,
      transactionId: true,
      transaction: { select: { postedAt: true } },
    },
  });
```

to:

```ts
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: {
      uploadFileUrl: true,
      transactionId: true,
      transaction: { select: { postedAt: true, status: { select: { name: true } } } },
    },
  });
```

Then change:

```ts
  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  await prisma.transactionLineItem.delete({ where: { id: lineItemId } });
```

to:

```ts
  if (existing.transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  if (existing.transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Cannot modify line items on a cancelled transaction." },
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
git commit -m "Return 409 from line-item routes when the transaction is cancelled"
```

---

### Task 4: Shared cancel-confirmation modal component

**Files:**
- Create: `components/dashboard/CancelTransactionModal.tsx`
- Test: `components/dashboard/CancelTransactionModal.test.tsx`

**Interfaces:**
- Consumes: `buttonSecondary` from `@/lib/deepForest` (existing).
- Produces: `CancelTransactionModal({ transactionCode, matrixTypeName, submitting, error, onCancel, onConfirm })` — a controlled component with no internal state. Tasks 5 and 6 both import and render this from `@/components/dashboard/CancelTransactionModal`.

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/CancelTransactionModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CancelTransactionModal } from "./CancelTransactionModal";

describe("CancelTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <CancelTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <CancelTransactionModal
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

  it("calls onConfirm when Delete is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <CancelTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both buttons while submitting and shows Deleting…", () => {
    render(
      <CancelTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <CancelTransactionModal
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
      <CancelTransactionModal
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

Run: `npx vitest run components/dashboard/CancelTransactionModal.test.tsx`
Expected: FAIL — `./CancelTransactionModal` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `components/dashboard/CancelTransactionModal.tsx`:

```tsx
"use client";

import { buttonSecondary } from "@/lib/deepForest";

export function CancelTransactionModal({
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
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-red-500/30 bg-[#1a0f0f] p-6 text-center shadow-[0_0_40px_rgba(248,113,113,0.25)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-xl">
          ⚠️
        </div>
        <h2
          id="cancel-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Delete this transaction?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-4 text-xs text-[#9db894]">
          This will cancel the transaction and move it to Canceled Transactions — this cannot be undone.
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
            className="flex-1 rounded-full bg-red-600/80 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-[0_8px_18px_rgba(220,38,38,0.35)] active:translate-y-0 active:bg-red-700 active:shadow-[0_3px_8px_rgba(220,38,38,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/50 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/dashboard/CancelTransactionModal.test.tsx`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/CancelTransactionModal.tsx components/dashboard/CancelTransactionModal.test.tsx
git commit -m "Add shared CancelTransactionModal component"
```

---

### Task 5: Detail page — Delete button and locking generalization

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: `DELETE /api/transactions/[id]` from Task 2 (no body, `204`/`403`/`404`/`409` with `{ error }`); `CancelTransactionModal` from Task 4.
- Produces: nothing new for later tasks — `page.tsx` needs no changes here, since `TransactionDetailData.statusName` already carries "Cancelled" once that's the real status, with no new field needed.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, append this new `describe` block at the very end of the file (after the final closing `});` of `describe("TransactionDetailView — Post/Unpost", ...)`):

```tsx
describe("TransactionDetailView — Delete", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  it("does not render a Delete button for a non-owner", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("renders a Delete button for the owner when not posted and not cancelled", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("does not render a Delete button for the owner once posted", () => {
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
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("opens the confirmation modal with the transaction code and type", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Visitor Pass")).toBeInTheDocument();
  });

  it("calls the DELETE endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("closes the modal without calling DELETE when Cancel is clicked", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hides Add Line Item, the Actions column, Post, and Delete once cancelled", () => {
    const cancelledTransaction = { ...visitorPassTransaction, statusName: "Cancelled" };
    render(
      <TransactionDetailView
        transaction={cancelledTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: FAIL — no Delete button, no cancel modal, no `isLocked`/`isCancelled` logic exist yet.

- [ ] **Step 3: Import the modal and compute `isCancelled`/`isLocked`**

Add this import alongside the existing ones at the top of `TransactionDetailView.tsx`:

```tsx
import { CancelTransactionModal } from "@/components/dashboard/CancelTransactionModal";
```

Change:

```tsx
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const isPosted = transaction.postedAt !== null;
  const baseColumns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;
  const columns = isPosted ? baseColumns.filter((column) => column !== "Actions") : baseColumns;
```

to:

```tsx
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const isPosted = transaction.postedAt !== null;
  const isCancelled = transaction.statusName === "Cancelled";
  const isLocked = isPosted || isCancelled;
  const baseColumns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;
  const columns = isLocked ? baseColumns.filter((column) => column !== "Actions") : baseColumns;
```

- [ ] **Step 4: Add the cancel state and handler**

Immediately after the existing `handleTogglePosted` function (right before the `return (` that starts the JSX), add:

```tsx
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function handleConfirmCancel() {
    setCancelError("");
    setCancelSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setCancelError(data.error ?? "Failed to delete transaction");
        setCancelSubmitting(false);
        return;
      }

      setCancelSubmitting(false);
      setShowCancelModal(false);
      router.refresh();
    } catch {
      setCancelError("An error occurred while deleting the transaction");
      setCancelSubmitting(false);
    }
  }
```

- [ ] **Step 5: Wire the Delete button into the button row**

Change:

```tsx
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
```

to:

```tsx
        <div className="flex items-center gap-2">
          {isOwner && !isCancelled && (
            <button
              type="button"
              onClick={handleTogglePosted}
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

- [ ] **Step 6: Switch the line-items Actions cell to `isLocked`**

Change:

```tsx
                  {!isPosted && (
                    <td className="whitespace-nowrap px-4 py-3">
```

to:

```tsx
                  {!isLocked && (
                    <td className="whitespace-nowrap px-4 py-3">
```

(the rest of that `<td>` block, the Edit/Delete line-item icon buttons, is unchanged)

- [ ] **Step 7: Render the modal**

Change the end of the component from:

```tsx
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-line-item-modal-title"
```

Find where that block closes — it ends with:

```tsx
      )}
    </div>
  );
}
```

Change that closing to:

```tsx
      )}

      {showCancelModal && (
        <CancelTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
```

(i.e. insert the new modal block between the existing `deleteTarget` modal's closing `)}` and the component's final `</div>\n  );\n}` — the `deleteTarget` modal's own JSX is untouched)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests including the 7 new ones.

- [ ] **Step 9: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing 2-failure baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 10: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"
git commit -m "Add Delete to the transaction detail page, generalize locking"
```

---

### Task 6: List page — Delete button and exported table component

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `DELETE /api/transactions/[id]` from Task 2; `CancelTransactionModal` from Task 4.
- Produces: `TransactionsTable` becomes an **exported** function (was private/unexported) with a new `showActions?: boolean` prop (default `true`). Task 7 imports `TransactionsTable` from `./TransactionsView` (relative to `open/`, i.e. `../open/TransactionsView` from `canceled/page.tsx`) and renders it with `showActions={false}`.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, change the import line from:

```ts
import { TransactionsView } from "./TransactionsView";
```

to:

```ts
import { TransactionsView, TransactionsTable } from "./TransactionsView";
```

Add this test immediately after the existing "renders the transactions table with the 7 core columns" test:

```ts
  it("renders without the Actions column when showActions is false", () => {
    render(<TransactionsTable rows={transactions} showActions={false} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(
      screen.queryByRole("button", { name: /^post$|^unpost$|^delete$/i })
    ).not.toBeInTheDocument();
  });
```

Append this new `describe` block at the end of the file:

```ts
describe("TransactionsView — Delete", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true }))
    );
  });

  it("shows a Delete button next to Post when the current user created the transaction and it isn't posted", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    expect(
      within(rowFor("OT-001")).getByRole("button", { name: /^delete$/i })
    ).toBeInTheDocument();
  });

  it("hides the Delete button once the transaction is posted", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    expect(
      within(rowFor("OT-001")).queryByRole("button", { name: /^delete$/i })
    ).not.toBeInTheDocument();
  });

  it("opens the confirmation modal with the transaction code and type, without navigating the row", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("calls the DELETE endpoint on confirm", async () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("closes the modal without calling DELETE when Cancel is clicked", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — `TransactionsTable` isn't exported yet, no Delete button, no cancel modal exist.

- [ ] **Step 3: Export `TransactionsTable` and add `showActions`, plus cancel state**

Change:

```tsx
function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter();
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed", "Actions"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<{ id: string; message: string } | null>(null);
```

to:

```tsx
export function TransactionsTable({
  rows,
  showActions = true,
}: {
  rows: TransactionRow[];
  showActions?: boolean;
}) {
  const router = useRouter();
  const baseColumns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed"];
  const columns = showActions ? [...baseColumns, "Actions"] : baseColumns;
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<{ id: string; message: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
```

Add this import alongside the existing ones at the top of the file:

```tsx
import { CancelTransactionModal } from "@/components/dashboard/CancelTransactionModal";
```

Immediately after the existing `handleTogglePosted` function's closing `}`, add:

```tsx

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelError("");
    setCancelSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${cancelTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setCancelError(data.error ?? "Failed to delete transaction");
        setCancelSubmitting(false);
        return;
      }

      setCancelSubmitting(false);
      setCancelTarget(null);
      router.refresh();
    } catch {
      setCancelError("An error occurred while deleting the transaction");
      setCancelSubmitting(false);
    }
  }
```

- [ ] **Step 4: Add the Delete button and gate the whole Actions cell on `showActions`**

Change:

```tsx
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
```

to:

```tsx
                  {showActions && (
                    <td className="whitespace-nowrap px-4 py-3">
                      {row.canManagePosting ? (
                        <div className="flex items-center gap-2">
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
                          {!row.postedAt && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCancelTarget(row);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors duration-150 hover:border-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/40 motion-reduce:transition-none"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className={mutedText}>—</span>
                      )}
                      {postError?.id === row.id && (
                        <p role="alert" className="mt-1 text-[10px] text-red-400">
                          {postError.message}
                        </p>
                      )}
                    </td>
                  )}
```

- [ ] **Step 5: Render the modal**

Change:

```tsx
      {enlargedRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
```

Find where that block closes — it ends with:

```tsx
      )}
    </>
  );
}
```

Change that closing to:

```tsx
      )}

      {cancelTarget && (
        <CancelTransactionModal
          transactionCode={cancelTarget.transactionCode}
          matrixTypeName={cancelTarget.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </>
  );
}
```

(i.e. insert the new modal block between the existing enlarge-QR modal's closing `)}` and the fragment's final `</>\n  );\n}` — the enlarge-QR modal's own JSX is untouched)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests including the new ones.

- [ ] **Step 7: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing 2-failure baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Add Delete Actions column to the Open Transactions list, export TransactionsTable"
```

---

### Task 7: Canceled Transaction page

**Files:**
- Modify: `app/(authenticated)/transactions/canceled/page.tsx` (currently a `PagePlaceholder`, becomes a real server component)

**Interfaces:**
- Consumes: `TransactionsTable` (exported, with its `showActions` prop) from `../open/TransactionsView`, produced by Task 6.
- Produces: nothing further — this is the last task.

No dedicated test file for this task: no `page.tsx` server component anywhere in this codebase has its own test file (verified — `open/page.tsx`, `dashboard/page.tsx`, etc. are all covered indirectly through their child client components' tests plus live verification). Coverage here comes from Task 6's `showActions` tests plus the live verification below.

- [ ] **Step 1: Replace the placeholder**

Replace the full contents of `app/(authenticated)/transactions/canceled/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { pageBackground, headingText, mutedText } from "@/lib/deepForest";
import { TransactionsTable } from "../open/TransactionsView";

export default async function CanceledTransactionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const transactions = await prisma.transaction.findMany({
    where: { status: { name: "Cancelled" } },
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
      canManagePosting: session?.sub === row.creatorId,
    }))
  );

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <div className="mb-4">
          <h1 className={`text-lg ${headingText}`}>Canceled Transaction</h1>
          <p className={`text-xs ${mutedText}`}>Historical record of cancelled requests</p>
        </div>
        <TransactionsTable rows={transactionRows} showActions={false} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing 2-failure baseline, nothing else new.
Run: `npm run build`
Expected: clean build, no type errors — confirms `TransactionsTable`'s exported type accepts this page's row shape and the `showActions` prop compiles.

- [ ] **Step 3: Commit**

```bash
git add "app/(authenticated)/transactions/canceled/page.tsx"
git commit -m "Build the Canceled Transaction page, reusing the Open Transactions table"
```

## Post-plan verification (controller, not a subagent)

After Task 7 is reviewed and committed, live-verify against the running dev server (restart it if a migration ran mid-session and it's stale — this plan has no migration, so a restart shouldn't be needed):

1. As the creator of an existing Open Transaction: click Delete from the list, confirm in the modal, verify the row disappears from Open Transactions.
2. Navigate to `/transactions/canceled` and confirm the same transaction now appears there, with the same columns/styling as Open Transactions, no Actions column, and clicking the row still opens its (now read-only) detail page.
3. On that detail page: confirm no Post/Unpost/Delete buttons render for anyone, "+ Add Line Item" is gone, and the line items table has no Actions column.
4. Try posting a transaction, then attempt Delete — confirm it's blocked (button already hidden in the UI; optionally confirm via a direct API call that it's also blocked server-side with `409`).
5. Confirm a non-creator viewing any transaction (open or cancelled) never sees a Delete button, in either the list or detail page.
