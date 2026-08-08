# Transaction Cancel (Soft Delete) — Design

**Date:** 2026-08-08
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, text-only — no visual mockups needed)

## Goal

Let a transaction's creator "Delete" it — permanently, but as a soft delete: the row is never removed from the database, only tagged Cancelled, for audit purposes. Cancelled transactions disappear from Open Transactions and instead appear on the Canceled Transaction page (currently an unbuilt placeholder), shown with the exact same table/columns/style Open Transactions already uses.

This is Part A of a two-part follow-up to the just-shipped Post/Unpost feature (`docs/superpowers/specs/2026-08-08-transaction-post-design.md`). Part B (a brand-new Edit capability) is deliberately deferred to a separate round — it needs the "+ Add Transaction" form extracted into a shared, reusable component first, which is out of scope here.

## Scope

- "Delete" = a status transition (`Transaction.statusId` → a new `"Cancelled"` `TransactionStatus` row), not a row deletion. No new columns.
- Restricted to the transaction's own creator, same gating pattern as Post/Unpost (`session.sub === transaction.creatorId`).
- **Not restorable.** No "Undo"/"Restore" action exists anywhere in this round — cancelling is permanent from the UI's perspective, even though the row itself survives in the database.
- Cancelling is blocked while a transaction is posted (`409` — "unpost first"), and blocked if it's already cancelled (`409`).
- Cancelling a transaction also makes it fully read-only everywhere, the same way posting already does — no further owner actions (Post/Unpost, Delete, line-item add/edit/delete) surface on a cancelled transaction.
- The Canceled Transaction page is read-only: same columns as Open Transactions, no Actions column, no "+ Add Transaction" button. Row click still navigates to the (now read-only) detail page.
- Out of scope: Edit (Part B), any change to the actual approval-routing workflow, any change to `Transaction.postedAt` semantics beyond reusing its existing "locked" concept.

## Design

### 1. Data model

`prisma/seed.ts`: `TRANSACTION_STATUSES` grows from `["Open"]` to `["Open", "Cancelled"]` — seeded via the existing `seedTransactionStatuses()` loop, no code change needed there beyond the array literal. `prisma/seed.test.ts`'s exact-array assertion for reference-data values needs updating to include `"Cancelled"` (a real, wanted seed-data change, not a regression to chase down).

No schema migration — `TransactionStatus` is already a table, not an enum, built specifically so a new lifecycle value like this needs no schema change at all.

### 2. API: `DELETE /api/transactions/[id]`

New handler added to the existing `app/api/transactions/[id]/route.ts` (which already exports `PATCH` for Post/Unpost):

- `401` if not authenticated.
- `404` if the transaction doesn't exist.
- `403` if `session.sub !== transaction.creatorId`.
- `409` if `transaction.postedAt !== null` — `{ error: "Unpost this transaction before deleting it." }`.
- `409` if the transaction's current status is already `"Cancelled"` — `{ error: "Transaction is already cancelled." }`.
- On success: looks up the `"Cancelled"` `TransactionStatus` row (`findUniqueOrThrow({ where: { name: "Cancelled" } })`, same lookup pattern already used throughout this codebase for status/reference rows) and sets `transaction.statusId` to it.
- `204` No Content on success — matches the existing line-item `DELETE` route's response convention.

No request body needed (unlike the `PATCH` handler) — `DELETE` here is a single, unparameterized action.

**The existing `PATCH` handler (Post/Unpost) also gains a check**, since it predates the Cancelled concept: after the existing creator check and before touching `postedAt`, it now also returns `409` (`{ error: "This transaction is cancelled." }`) if the transaction's status is `"Cancelled"`. The UI already hides the Post/Unpost button once cancelled (section 4), but this app's established convention is that server-side checks never rely on the UI alone to enforce a rule (the line-item routes' `409` guard is the same idea) — a direct API call must be rejected too.

### 3. Shared confirmation modal

A new component (e.g. `components/dashboard/CancelTransactionModal.tsx` or colocated wherever fits best once the plan is written) reusing the exact visual pattern of the existing line-item delete-confirmation modal: a detail card showing the transaction's code and type, "Cancel"/"Delete" buttons, no backdrop-click or Escape dismissal (matching this app's established modal convention for consequential actions). Copy states the real, permanent effect plainly: "This will cancel the transaction and move it to Canceled Transactions — this cannot be undone." Used identically from both `TransactionsView.tsx` (list) and `TransactionDetailView.tsx` (detail page) rather than duplicated in each.

### 3b. Line-item routes also gain a cancelled check

The three line-item routes (`POST` create, `PATCH` edit, `DELETE`) already reject with `409` when `transaction.postedAt !== null`. A transaction can be cancelled while **not** posted (posting must be undone before deleting, per section 2), so without a separate check, a cancelled-but-never-reposted transaction's line items would still be editable via a direct API call — defeating the audit-record intent. Each route adds a second, independent check, kept as its own distinct message rather than rewritten into the existing one (the existing "posted" message and its tests, from the just-shipped Post/Unpost plan, stay untouched):

```ts
if (transaction.status.name === "Cancelled") {
  return NextResponse.json(
    { error: "Cannot modify line items on a cancelled transaction." },
    { status: 409 }
  );
}
```

This needs each route's existing Prisma query to also fetch `status: { select: { name: true } }` alongside `postedAt` (the `POST` and `PATCH` routes already fetch the transaction with room to add this; `DELETE`'s nested `transaction: { select: { postedAt: true } }` from the Post/Unpost plan gains `status: { select: { name: true } }` alongside it).

### 4. Locking generalization (detail page)

`TransactionDetailView.tsx` currently derives `isPosted` and uses it to hide "+ Add Line Item", the line items table's Actions column, and to switch the header button between POST/UNPOST. This becomes `isLocked = isPosted || isCancelled` (where `isCancelled = transaction.statusName === "Cancelled"`), and every place that currently checks `isPosted` for hiding editable affordances switches to `isLocked`. The owner's action row itself (currently just POST/UNPOST) additionally requires `!isCancelled` before rendering at all — once cancelled, there is nothing left to do (no Unpost, no Delete, nothing), matching "not restorable."

The DELETE button itself: visible only when `isOwner && !isPosted && !isCancelled` (you must unpost before deleting, and you can't delete twice).

### 5. List page (`TransactionsView.tsx`)

Every row already shown in Open Transactions is non-cancelled by definition (the query already filters to `status: "Open"`), so the Actions column's gating only needs the existing not-posted check: `canManagePosting && !postedAt` shows both Post and Delete side by side; `canManagePosting && postedAt` shows only Unpost (Delete is unavailable while posted, matching the detail page). Clicking Delete opens the shared confirmation modal; confirming calls `DELETE /api/transactions/[id]` then `router.refresh()` (the row disappears from the list because it no longer matches the query, no client-side row removal needed).

### 6. Canceled Transaction page

`app/(authenticated)/transactions/canceled/page.tsx` stops being a `PagePlaceholder` and becomes a real server component, structurally identical to `open/page.tsx` except its query filters `status: { name: "Cancelled" }` instead of `"Open"`, and it does not fetch the matrix-type/department/business-unit lists `open/page.tsx` only needs for its "+ Add Transaction" modal.

`TransactionsView.tsx`'s private row-rendering function (currently unexported, handles the table itself — QR thumbnails, columns, row click-to-detail, the enlarge-QR modal) is exported and gains a `showActions: boolean` prop (defaulting `true`, so the existing Open Transactions usage is unaffected). The Canceled page imports this exported table component directly and renders it with `showActions={false}` — same columns, same QR/row-click behavior, no Actions column. No new "list view" wrapper component is needed since this table component is usable directly from a server component.

### 7. Testing

- `prisma/seed.test.ts`: update the reference-data exact-array assertion to include `"Cancelled"`.
- `app/api/transactions/[id]/route.test.ts`: new cases for `DELETE` — 401/404/403/409 (posted)/409 (already cancelled)/204, plus a check that `statusId` actually points at the `"Cancelled"` row afterward and that `postedAt` is untouched by a delete (it isn't reachable anyway, since posted blocks delete, but confirms no accidental cross-contamination). Also a new case for the existing `PATCH` handler: `409` when attempting to post/unpost an already-cancelled transaction.
- Both line-item route test files: one new `409` case each for a cancelled (but not posted) transaction, asserting the new distinct message.
- `TransactionDetailView.test.tsx`: Delete button visible only for the owner and only when not posted/not cancelled; confirmation modal shows transaction code/type; confirming calls the `DELETE` endpoint; once cancelled (`statusName: "Cancelled"` fixture), no owner actions render at all, matching the posted-transaction test's shape.
- `TransactionsView.test.tsx`: Delete button appears in the Actions column for owned, non-posted rows; clicking opens the confirmation modal without navigating the row; confirming calls `DELETE /api/transactions/{id}`.
- New test file for the Canceled Transaction page/component: renders the same 6 columns as Open Transactions minus Actions, row click still navigates to the detail page.

## Out of scope

- Edit (Part B — a separate spec/plan, needs the Add Transaction form extracted into a shared component first).
- Any "Restore"/"Undo cancel" action.
- Any change to `Transaction.postedAt` itself or the Post/Unpost feature's own behavior beyond reusing its "locked" concept.
- Recording who cancelled a transaction or when, beyond what the status transition itself implies — no new timestamp/audit columns, since the user asked for the same table format Open Transactions already has, and status is the single source of truth for "cancelled" here.
