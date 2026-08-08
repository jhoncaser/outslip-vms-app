# Transaction Post/Unpost (Finalize Line Items) — Design

**Date:** 2026-08-08
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, text-only — no visual mockups needed)

## Goal

Let the creator of an Open Transaction "Post" it to finalize their request: once posted, nobody can add, edit, or delete that transaction's line items. Posting is reversible via an "Unpost" action. This picks up a feature explicitly deferred twice earlier in this project (see `docs/superpowers/2026-07-19-green-rebrand-handoff.md` §3ah/§3am) — the "Post" button referenced in this app's original legacy-system reference screenshots, now buildable since the header + line-item work it depends on is complete.

## Scope

- Post/Unpost is available both on the Open Transactions list (a new Actions column) and on the transaction detail page.
- Only the transaction's own creator can post or unpost it.
- Once posted, line-item add/edit/delete is blocked for **everyone** viewing the transaction (not just non-creators) — both in the UI and enforced server-side.
- No change to who can add/edit/delete line items on a transaction that is *not* posted — that stays exactly as open as it is today (no creator restriction there; out of scope to add one).
- No change to the `Transaction.status` / `TransactionStatus` table, the Open Transactions list's existing `status: "Open"` filter, or any future approval-routing workflow — those remain entirely separate, unbuilt concerns.

## Design

### 1. Data model

New nullable column on `Transaction`:

```prisma
model Transaction {
  // ...existing fields...
  postedAt DateTime?
}
```

`null` = not posted. A pure additive migration (no drops, no backfill, no interaction with `statusId`). Applied to the live local `perso_proj` Postgres DB the same way every prior migration on this branch has been.

### 2. API

**New `PATCH /api/transactions/[id]`:**

- `401` if not authenticated.
- `404` if the transaction doesn't exist.
- `403` if `session.sub !== transaction.creatorId` (only the creator may post/unpost — checked after existence, before touching `postedAt`).
- `400` if the request body doesn't match `z.object({ posted: z.boolean() })`.
- `200` on success: sets `postedAt: new Date()` when `posted: true`, or `postedAt: null` when `posted: false`. Returns the updated `postedAt` (ISO string or `null`).
- No other business-rule validation (e.g. no minimum line-item count to post) — not requested, not added.

**Existing line-item routes gain a guard**, checked immediately after the existing "does this line item belong to this transaction" check and before any field validation:

- `app/api/transactions/[id]/line-items/route.ts` (`POST`)
- `app/api/transactions/[id]/line-items/[lineItemId]/route.ts` (`PATCH`, `DELETE`)

Each already fetches (or can cheaply extend its existing fetch of) the parent `Transaction`; add `postedAt` to that select. If `transaction.postedAt !== null`, return `409` with `{ error: "Cannot modify line items on a posted transaction." }` before any other work. This applies regardless of who's calling it — posting locks line items for everyone, including the creator.

### 3. Detail page (`TransactionDetailView.tsx` / its `page.tsx`)

- `page.tsx` gains a session lookup (it doesn't have one today) and computes `isOwner = session?.sub === transaction.creatorId`, passed down alongside a formatted `postedAt: string | null` on `TransactionDetailData`.
- Header card: when `postedAt` is set, a small green "POSTED" pill (reusing `pillClass("green")`) appears next to the Status field.
- Button row above the line items table (currently just "+ Add Line Item"):
  - Not posted, `isOwner`: show **POST** and **+ Add Line Item** side by side.
  - Not posted, not owner: show only **+ Add Line Item** (unchanged from today).
  - Posted, `isOwner`: **+ Add Line Item** is gone; **UNPOST** shows in its place.
  - Posted, not owner: neither button renders — just the badge.
- Line items table: when posted, the "Actions" column (header cell and every row's ✏️/🗑️ cell) is omitted entirely from the `columns` array and row rendering, for every viewer — not just hidden via CSS, and not just disabled buttons.
- Posting requires confirmation: `window.confirm("Post this transaction? You won't be able to add, edit, or delete line items until you unpost it.")`. On confirm, `PATCH` the new endpoint with `{ posted: true }`, then `router.refresh()`. Unposting has no confirmation step — `PATCH` with `{ posted: false }` then `router.refresh()` directly.
- A failed PATCH (network error, or a `403`/`404` that shouldn't normally be reachable through the UI but could happen from a stale page) shows an inline `role="alert"` error message near the button, matching this app's existing inline-error convention — no modal needed for this since there's no destructive data risk to walk back from.

### 4. Open Transactions list (`TransactionsView.tsx` / its `page.tsx`)

- `page.tsx` already has `session` in scope; add `postedAt` to the existing `Transaction.findMany` select/include and compute `canManagePosting: boolean` (`row.creatorId === session?.sub`) per row. `TransactionRow` gains `postedAt: string | null` and `canManagePosting: boolean`.
- New "Actions" column appended after "Date Filed" — the first Actions column this table has had.
  - `canManagePosting && !postedAt`: **Post** button.
  - `canManagePosting && postedAt`: **Unpost** button.
  - `!canManagePosting`: `"—"`, matching the empty-value dash convention already used throughout this app's tables.
- Both buttons call `event.stopPropagation()` before their click handler runs (same pattern the QR thumbnail button in this file already uses), so clicking Post/Unpost never triggers the row's navigate-to-detail behavior. Same confirm-on-post / no-confirm-on-unpost behavior as the detail page.
- Status column: the existing status pill gains the same small "POSTED" badge next to it when `postedAt` is set.

### 5. Testing

- New `app/api/transactions/[id]/route.test.ts`: `401`, `403` (non-creator attempts to post), `404`, `400` (bad body), `200` posting (verifies `postedAt` becomes a `Date`), `200` unposting (verifies `postedAt` becomes `null`).
- Line-item route test files (`line-items/route.test.ts`, `line-items/[lineItemId]/route.test.ts`) each gain one new `409` case: attempting the action against a transaction with `postedAt` already set.
- `TransactionDetailView.test.tsx`: badge renders only when posted; POST button renders only for the owner and only when not posted, and calls the confirm dialog; UNPOST button renders only for the owner and only when posted, with no confirm dialog; Actions column and its cells are entirely absent from the DOM once posted (not just visually hidden); non-owner sees no button in either state.
- `TransactionsView.test.tsx`: Actions column shows Post/Unpost only on rows where `canManagePosting` is true, `"—"` otherwise; clicking Post/Unpost does not navigate the row.

## Out of scope

- Any change to `Transaction.status`/`TransactionStatus`, or the Open Transactions list's `status: "Open"` filter.
- Restricting line-item add/edit/delete to the creator on a transaction that isn't posted — stays fully open, as it is today.
- Any minimum-line-item-count or other business-rule gate on posting.
- A custom confirmation modal (matching the delete-line-item modal's detail-card style) for posting — a native `window.confirm()` is enough for a reversible action.
- Wiring "Posted" into the still-unbuilt approval-routing workflow (1st/2nd/3rd Level Approver, Approved/Canceled transitions) — that remains a separate, future feature.
