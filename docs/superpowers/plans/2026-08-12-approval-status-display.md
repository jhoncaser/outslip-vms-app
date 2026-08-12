# Approval-Progress Status Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat status pill + separate green "POSTED" badge, shown everywhere a transaction's status renders, with a single dynamic status string: `"Open"` before posting, `"Waiting to be approved in 1st/2nd/3rd Level"` while posted and pending, and `"Approved"`/`"Cancelled"` unchanged for those terminal states.

**Architecture:** One new pure-function helper (`lib/approvalStatusText.ts`) is the single source of truth for the display string. Every page that currently constructs a `TransactionRow` or `TransactionDetailData` object computes a new `statusDisplay` field using that helper (reusing the existing `getApprovalState` engine, unchanged) and the two shared UI components (`TransactionsTable`, `TransactionDetailView`) render that field in place of the old `{statusName} + POSTED pill` pair.

**Tech Stack:** Next.js 16 (App Router), Prisma + PostgreSQL, Vitest + Testing Library, TypeScript.

## Global Constraints

- Wording is exact: `"Waiting to be approved in 1st Level"` / `"2nd Level"` / `"3rd Level"` for pending level 1/2/3 — reusing the same ordinal phrasing already used elsewhere on this branch (`TransactionDetailView.tsx`'s existing local `LEVEL_LABELS`), but as its own small map inside the new helper file, not a shared import — refactoring those pre-existing copies is out of scope.
- Unposted `"Open"`, `"Approved"`, and `"Cancelled"` all display their plain `statusName` unchanged — only the posted-and-pending case gets new text.
- The separate green "POSTED" badge/pill is deleted everywhere it currently renders (`TransactionsTable`'s Status column, `TransactionDetailView`'s Status field) — no replacement badge, the new text is the sole status indicator.
- Both `TransactionRow` (in `TransactionsView.tsx`) and `TransactionDetailData` (in `TransactionDetailView.tsx`) keep their existing `statusName: string` field unchanged — other logic still reads it (e.g. `TransactionDetailView.tsx`'s `isCancelled = transaction.statusName === "Cancelled"`) — and gain a new, additional `statusDisplay: string` field for what's actually rendered.
- `app/(authenticated)/transactions/open/[id]/page.tsx`'s prior cutover (removing `isPendingApprover`/`isFinalApprovalLevel` so Approve/Revise/Cancel don't render there) is **not reverted**. This plan adds back only a minimal, display-only `pendingLevel` lookup — the two removed props stay removed/defaulted-false.
- `app/(authenticated)/transactions/canceled/page.tsx` needs no real computation — every row there has `status.name === "Cancelled"`, so its `statusDisplay` is just `row.status.name` directly, no helper call, no new import.
- No new npm dependencies.

---

### Task 1: `lib/approvalStatusText.ts` — status text formatter

**Files:**
- Create: `lib/approvalStatusText.ts`
- Test: `lib/approvalStatusText.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `formatApprovalStatusText(statusName: string, pendingLevel: number | null): string` — consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

Create `lib/approvalStatusText.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatApprovalStatusText } from "./approvalStatusText";

describe("formatApprovalStatusText", () => {
  it("returns the status name unchanged when there is no pending level", () => {
    expect(formatApprovalStatusText("Open", null)).toBe("Open");
  });

  it("returns 'Waiting to be approved in 1st Level' when level 1 is pending", () => {
    expect(formatApprovalStatusText("Open", 1)).toBe("Waiting to be approved in 1st Level");
  });

  it("returns 'Waiting to be approved in 2nd Level' when level 2 is pending", () => {
    expect(formatApprovalStatusText("Open", 2)).toBe("Waiting to be approved in 2nd Level");
  });

  it("returns 'Waiting to be approved in 3rd Level' when level 3 is pending", () => {
    expect(formatApprovalStatusText("Open", 3)).toBe("Waiting to be approved in 3rd Level");
  });

  it("returns 'Approved' unchanged even if a pending level is somehow passed", () => {
    expect(formatApprovalStatusText("Approved", 1)).toBe("Approved");
  });

  it("returns 'Cancelled' unchanged regardless of pending level", () => {
    expect(formatApprovalStatusText("Cancelled", 1)).toBe("Cancelled");
    expect(formatApprovalStatusText("Cancelled", null)).toBe("Cancelled");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/approvalStatusText.test.ts`
Expected: FAIL — `lib/approvalStatusText.ts` does not exist yet (module resolution error).

- [ ] **Step 3: Write the implementation**

Create `lib/approvalStatusText.ts`:

```ts
const LEVEL_LABELS: Record<number, string> = {
  1: "1st Level",
  2: "2nd Level",
  3: "3rd Level",
};

export function formatApprovalStatusText(
  statusName: string,
  pendingLevel: number | null
): string {
  if (statusName !== "Open" || pendingLevel === null) {
    return statusName;
  }

  const levelLabel = LEVEL_LABELS[pendingLevel] ?? `Level ${pendingLevel}`;
  return `Waiting to be approved in ${levelLabel}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/approvalStatusText.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/approvalStatusText.ts lib/approvalStatusText.test.ts
git commit -m "Add formatApprovalStatusText helper"
```

---

### Task 2: List-view status display (Open Transactions, Canceled Transaction, My Approvals)

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`
- Modify: `app/(authenticated)/transactions/open/page.tsx`
- Modify: `app/(authenticated)/transactions/canceled/page.tsx`
- Modify: `app/(authenticated)/transactions/my-approvals/page.tsx`

These five files must land together — `TransactionRow` gaining a required `statusDisplay` field only compiles once every place that constructs one supplies it, so this task's deliverable is "list-view status display is fully wired end to end and buildable," not any single file in isolation.

**Interfaces:**
- Consumes: `formatApprovalStatusText(statusName: string, pendingLevel: number | null): string` (Task 1); `getApprovalState(transactionId: string): Promise<ApprovalState>` from `lib/transactionApproval.ts` (existing, unchanged — `ApprovalState.pendingLevel: number | null`).
- Produces: `TransactionRow` type gains `statusDisplay: string`, consumed by Task 3 only insofar as both types now share the same field name/shape (no direct code dependency between Tasks 2 and 3).

- [ ] **Step 1: Update the `TransactionRow` type and Status cell rendering**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, find the `TransactionRow` type (currently around line 19-41) and add `statusDisplay` immediately after `statusName`:

```tsx
  statusName: string;
  statusDisplay: string;
```

Then find the Status `<td>` inside `TransactionsTable` (currently around lines 210-214):

```tsx
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={pillClass("slate")}>{row.statusDisplay}</span>
                  </td>
```

(This deletes the old `{row.postedAt && <span className={\`ml-2 ${pillClass("green")}\`}>POSTED</span>}` line entirely — `row.postedAt` itself stays on the type, still used by the Post/Unpost button logic elsewhere in this same component.)

- [ ] **Step 2: Update `TransactionsView.test.tsx`'s fixtures and the one test that asserts the removed badge**

Add `statusDisplay: "Open",` immediately after each fixture's `statusName: "Open",` line — both the `transactions` array (around line 30) and the `visitorPassTransactions` array (around line 55).

Find this test (currently around lines 763-770):

```ts
  it("shows an Unpost button and a POSTED badge when already posted", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    const row = rowFor("OT-001");
    expect(within(row).getByRole("button", { name: /^unpost$/i })).toBeInTheDocument();
    expect(within(row).getByText("POSTED")).toBeInTheDocument();
  });
```

Replace it with:

```ts
  it("shows an Unpost button when already posted", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    const row = rowFor("OT-001");
    expect(within(row).getByRole("button", { name: /^unpost$/i })).toBeInTheDocument();
  });

  it("renders statusDisplay text in the Status column instead of a separate POSTED badge", () => {
    renderView("", [
      {
        ...transactions[0],
        statusDisplay: "Waiting to be approved in 1st Level",
        postedAt: "2026-08-08T00:00:00.000Z",
      },
    ]);
    const row = rowFor("OT-001");
    expect(within(row).getByText("Waiting to be approved in 1st Level")).toBeInTheDocument();
    expect(within(row).queryByText("POSTED")).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the focused test to verify Steps 1-2 work together**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests in this file green (including the two new/updated ones from Step 2). This test file only depends on Steps 1-2 (the component and its own test) — Steps 4-6 below touch separate page files and don't affect this file's pass/fail; they're verified together with everything else via the full suite and build in Steps 7-8.

- [ ] **Step 4: Wire the Open Transactions list page**

In `app/(authenticated)/transactions/open/page.tsx`, add two imports after the existing `pageBackground` import:

```tsx
import { getApprovalState } from "@/lib/transactionApproval";
import { formatApprovalStatusText } from "@/lib/approvalStatusText";
```

Then in the `transactionRows` mapping, find the `statusName: row.status.name,` line and add `statusDisplay` immediately after it:

```tsx
      statusName: row.status.name,
      statusDisplay: row.postedAt
        ? formatApprovalStatusText(
            row.status.name,
            (await getApprovalState(row.id)).pendingLevel
          )
        : row.status.name,
```

(This follows the same inline-`await`-inside-an-object-literal style already used two lines above for `qrDataUrl`. Unposted rows skip the `getApprovalState` call entirely and just reuse `row.status.name`, which is always `"Open"` pre-post.)

- [ ] **Step 5: Wire the Canceled Transaction page**

In `app/(authenticated)/transactions/canceled/page.tsx`, find `statusName: row.status.name,` in its `transactionRows` mapping and add immediately after it:

```tsx
      statusName: row.status.name,
      statusDisplay: row.status.name,
```

No new import — every row here is always `"Cancelled"`, so this is a direct pass-through, not a call to the formatter.

- [ ] **Step 6: Wire the My Approvals list page**

In `app/(authenticated)/transactions/my-approvals/page.tsx`, add the same two imports as Step 4:

```tsx
import { getApprovalState } from "@/lib/transactionApproval";
import { formatApprovalStatusText } from "@/lib/approvalStatusText";
```

Then in its `transactionRows` mapping, find `statusName: row.status.name,` and add immediately after it, identical to Step 4:

```tsx
      statusName: row.status.name,
      statusDisplay: row.postedAt
        ? formatApprovalStatusText(
            row.status.name,
            (await getApprovalState(row.id)).pendingLevel
          )
        : row.status.name,
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: compare against the known baseline — 2 pre-existing failures in `prisma/seed.test.ts` (documented, unrelated). If you see more, re-run just the extra failing file(s) in isolation before concluding anything — this codebase has a documented transient parallel-test-worker race; report the isolated-rerun result, not just the first full-suite number.

- [ ] **Step 8: Run the build**

Run: `npm run build`
Expected: clean build, no TypeScript errors (this is the step that would catch a missed `statusDisplay` field on any of the three page-level object literals).

- [ ] **Step 9: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx" "app/(authenticated)/transactions/open/page.tsx" "app/(authenticated)/transactions/canceled/page.tsx" "app/(authenticated)/transactions/my-approvals/page.tsx"
git commit -m "Show approval-progress text in place of the POSTED badge on transaction list views"
```

---

### Task 3: Detail-view status display (Open Transaction detail, My Approvals detail)

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx`
- Modify: `app/(authenticated)/transactions/my-approvals/[id]/page.tsx`

Same reasoning as Task 2: `TransactionDetailData` gaining a required `statusDisplay` field only compiles once both consumers supply it.

**Interfaces:**
- Consumes: `formatApprovalStatusText(statusName: string, pendingLevel: number | null): string` (Task 1); `getApprovalState(transactionId: string): Promise<ApprovalState>` (existing, unchanged).
- Produces: nothing consumed by a later task in this plan — this is the last task.

- [ ] **Step 1: Update the `TransactionDetailData` type and Status field rendering**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`, find the `TransactionDetailData` type (currently around line 21-32) and add `statusDisplay` immediately after `statusName`:

```tsx
  statusName: string;
  statusDisplay: string;
```

Then find the Status `<p>` (currently around lines 486-491):

```tsx
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
              Status
            </p>
            <p className="flex items-center gap-2 text-sm text-[#eafbe4]">
              {transaction.statusDisplay}
            </p>
```

(This deletes the old `{isPosted && <span className={pillClass("green")}>POSTED</span>}` line. The `isPosted` local stays — it's still used elsewhere in this file for `isLocked`, the Post/Unpost button label, etc.)

- [ ] **Step 2: Update `TransactionDetailView.test.tsx`'s fixture and the one test that asserts the removed badge**

Add `statusDisplay: "Open",` immediately after `statusName: "Open",` in the `visitorPassTransaction` base fixture (currently around line 14) — `otherTransaction` spreads this fixture, so it's covered automatically.

Find this test (currently around lines 787-801):

```ts
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
```

Replace it with:

```ts
  it("hides + Add Line Item and the Actions column once posted, for every viewer", () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });

  it("renders statusDisplay text in the Status field instead of a separate POSTED badge", () => {
    const waitingTransaction = {
      ...visitorPassTransaction,
      statusDisplay: "Waiting to be approved in 1st Level",
      postedAt: "2026-08-08T00:00:00.000Z",
    };
    render(
      <TransactionDetailView
        transaction={waitingTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("Waiting to be approved in 1st Level")).toBeInTheDocument();
    expect(screen.queryByText("POSTED")).not.toBeInTheDocument();
  });
```

Note: the pre-existing test `"hides Add Line Item, the Actions column, Post, and Delete once cancelled"` (around line 952) sets `statusName: "Cancelled"` via spread and asserts only `isLocked`-driven behavior, not status text — it needs no change, since `statusName` (unchanged field) still drives `isCancelled` internally.

- [ ] **Step 3: Run the focused test**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: run after Steps 1-2 land together. PASS, all tests in this file green.

- [ ] **Step 4: Add back a minimal, display-only pending-level lookup on the Open Transaction detail page**

In `app/(authenticated)/transactions/open/[id]/page.tsx`, add two imports after the existing `findScopeMatchedApprovers` import:

```tsx
import { getApprovalState } from "@/lib/transactionApproval";
import { formatApprovalStatusText } from "@/lib/approvalStatusText";
```

Immediately after the `approvers` construction (the `const approvers: ApproverRow[] = matchedApprovers.map(...)` block) and before `const detailFieldCandidates`, add:

```tsx
  const pendingLevel =
    transaction.postedAt !== null && transaction.status.name !== "Cancelled"
      ? (await getApprovalState(id)).pendingLevel
      : null;
```

Then in the `transactionDetail` object, find `statusName: transaction.status.name,` and add immediately after it:

```tsx
    statusName: transaction.status.name,
    statusDisplay: formatApprovalStatusText(transaction.status.name, pendingLevel),
```

This does **not** reintroduce `isPendingApprover`/`isFinalApprovalLevel` — those stay removed from this file, and the `<TransactionDetailView>` call keeps only `isOwner`/`approvers` as before, unchanged.

- [ ] **Step 5: Wire the My Approvals detail page**

In `app/(authenticated)/transactions/my-approvals/[id]/page.tsx`, add one import alongside the existing `getApprovalState` import:

```tsx
import { formatApprovalStatusText } from "@/lib/approvalStatusText";
```

This file already computes `approvalState` in full (kept for the real `isPendingApprover`/`isFinalApprovalLevel`). In the `transactionDetail` object, find `statusName: transaction.status.name,` and add immediately after it:

```tsx
    statusName: transaction.status.name,
    statusDisplay: formatApprovalStatusText(
      transaction.status.name,
      approvalState?.pendingLevel ?? null
    ),
```

No new `getApprovalState` call — this reuses the `approvalState` variable already in scope.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: compare against the known baseline (2 pre-existing `prisma/seed.test.ts` failures). Re-run any extras in isolation before concluding a regression, per the documented parallel-test-worker race.

- [ ] **Step 7: Run the build**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx" "app/(authenticated)/transactions/open/[id]/page.tsx" "app/(authenticated)/transactions/my-approvals/[id]/page.tsx"
git commit -m "Show approval-progress text in place of the POSTED badge on transaction detail views"
```

---

## Post-plan verification checklist

- [ ] Full suite green at the standard baseline (only the known seed-admin-drift and reference-data-drift failures).
- [ ] `npm run build` clean.
- [ ] Live walkthrough: an unposted transaction shows "Open"; posting it (with a configured multi-level approver chain) shows "Waiting to be approved in 1st Level"; approving level 1 advances it to "Waiting to be approved in 2nd Level"; the final approval shows "Approved" alone; a cancelled transaction still shows "Cancelled"; nowhere does a separate green "POSTED" pill appear anymore.
- [ ] Confirm the "Waiting to be approved in 1st Level" text reads acceptably as a pill at actual screen width — if not, that's a fast follow-up style tweak, not a blocker (see spec's Visual note).
