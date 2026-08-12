# My Approvals Worklist Page — Design

## Context

The "My Approvals" dashboard tile and its route gate (`canViewApprovals`) have existed since §3i, and the transaction approval engine (Approve/Revise/Cancel actions, `getApprovalState`, `findScopeMatchedApprovers`) shipped in the transaction approval workflow, Round 1 (§3ax) — but `/transactions/my-approvals` has stayed an unbuilt `PagePlaceholder` the whole time, and the only place to act on a pending approval is the Open Transaction detail page (`/transactions/open/[id]`), which shows Approve/Revise/Cancel to *any* pending approver who happens to open it.

This round (Round 2, referenced as future work in the §3ax handoff entry) builds the real worklist page and relocates approver actions there exclusively.

## Goals

- `/transactions/my-approvals` shows a table of transactions currently awaiting *this* user's approval — same table look as Open Transaction, filtered to exactly the transactions where the signed-in user is the pending-level approver.
- Clicking a row opens a detail page identical in design to today's Open Transaction detail page, with Approve/Revise/Cancel(-as-reject) available.
- Open Transaction (list and detail) no longer shows Approve/Revise/Cancel-as-reject to anyone, for any transaction — those actions live only under My Approvals from now on.

## Out of scope

- Row-level quick-action buttons (Approve/Revise from the table itself) — actions stay detail-page-only, per user decision.
- Any change to Post/Unpost or the creator's own Delete/Cancel button — those are unaffected and continue to work exactly as they do today, on both Open Transaction and (incidentally) the new My Approvals detail route, since they're gated on `isOwner`, not on approver status.
- Any change to Round 3 (Approved Transaction page, Open Transactions list status display) — untouched by this round.
- Any change to the "List Approvers" read-only panel — it stays visible on both routes; it's informational, not an action.

## Filtering logic (`lib/myApprovals.ts`, new)

```
findPendingApprovalTransactionIds(approverId: string): Promise<string[]>
```

- Queries all `Transaction` rows where `postedAt` is not null and `status.name === "Open"`. This single condition is sufficient to exclude both cancelled transactions (status becomes `"Cancelled"`) and fully-approved ones (status becomes `"Approved"` the moment the last level approves) — no separate cancelled/approved checks needed.
- For each candidate, calls the existing `getApprovalState(id)` helper (unchanged) and keeps the transaction only if its `pendingLevel`'s approver matches `approverId`.
- Returns matching transaction IDs. The list page then does its own `findMany` (with the same field selection `open/page.tsx` already uses) filtered to those IDs, so all the existing row-mapping logic (QR codes, date formatting, etc.) is reused unchanged rather than duplicated inside the new helper.
- This is a per-candidate sequential lookup (N+1-shaped), matching the precedent already accepted in `lib/matchApprovers.ts` and the QR-generation loop in `open/page.tsx` — acceptable at this app's transaction volume, not something to optimize preemptively.

## My Approvals list page (`app/(authenticated)/transactions/my-approvals/page.tsx`)

- Replaces the current `PagePlaceholder`.
- Gate: `if (!session || !canViewApprovals(session)) redirect("/dashboard")` — same shape as `register/page.tsx`'s `canProvisionUsers` gate (full block, not the read-only-open pattern Settings uses, since a non-approver has no legitimate reason to see this page at all).
- Fetches pending IDs via `findPendingApprovalTransactionIds(session.sub)`, then the matching transactions, mapped to `TransactionRow[]` the same way `open/page.tsx` does today (duplicated mapping code, matching this codebase's existing sibling-list-page convention — e.g. `canceled/page.tsx` already duplicates this same mapping rather than sharing it).
- Renders `<TransactionsTable rows={...} showActions={false} detailBasePath="/transactions/my-approvals" emptyMessage="No transactions waiting on your approval." />`.
- Header: `<h1>My Approvals</h1>` / subtitle "Transactions waiting on your approval" — same layout as Open Transaction's header, no "+ Add Transaction" button (this page never creates transactions).

### `TransactionsTable` change

New optional prop `detailBasePath` (default `"/transactions/open"`, preserving current behavior everywhere else it's used — Open Transaction and Canceled Transaction both keep working unchanged). Used in place of the hardcoded `/transactions/open/${row.id}` in the row's click handler and `Enter`/`Space` keydown handler.

## My Approvals detail page (`app/(authenticated)/transactions/my-approvals/[id]/page.tsx`, new)

- Same gate as the list page.
- Data-fetching duplicates `open/[id]/page.tsx`'s shape (transaction + line items + matched approvers + `getApprovalState`) — this route is the only place going forward where `isPendingApprover`/`isFinalApprovalLevel` are computed and passed as real values.
- Renders the existing `TransactionDetailView` unchanged, passing `backHref="/transactions/my-approvals"`.
- Reachable by direct URL for any authenticated user (matching how `/transactions/open/[id]` already works today) — this page is a convenience view, not the security boundary. The actual enforcement stays where it already lives: the approve/revise/cancel API routes independently verify `pendingApprover.approverId === session.sub` server-side before making any change, regardless of which page the request came from.

### `TransactionDetailView` change

New optional prop `backHref` (default `"/transactions/open"`), used for the existing Back link's `href` instead of the hardcoded value. No other change to this component — Approve/Revise/Cancel-as-reject already render conditionally on `isPendingApprover`, which is exactly the lever this design needs.

## Open Transaction changes (`app/(authenticated)/transactions/open/[id]/page.tsx`)

- Removes its `getApprovalState` call and the `isPendingApprover`/`isFinalApprovalLevel` computation entirely (dead code once nothing on this route uses it).
- Stops passing those two props to `TransactionDetailView`, which falls back to its existing `isPendingApprover = false` / `isFinalApprovalLevel = false` defaults — so Approve/Revise/Cancel-as-reject never render here, for anyone, regardless of approval state.
- `approvers` (the read-only "List Approvers" panel data) is untouched and keeps rendering on this route — it's informational, not gated on pending-approver status.
- Open Transaction's list page and table are unaffected — they never rendered these buttons.

## Testing

- `lib/myApprovals.test.ts` (new, real-DB integration test, matching the `lib/matchApprovers.test.ts` precedent — not mocked): covers (a) transaction where the test user is the pending level-1 approver → included; (b) transaction where a *different* level is currently pending → excluded; (c) unposted transaction → excluded; (d) cancelled transaction → excluded; (e) fully-approved transaction → excluded; (f) transaction where the test user isn't anywhere in the matched-approver chain → excluded.
- `TransactionsView.test.tsx` (covers `TransactionsTable`): new case asserting a custom `detailBasePath` is used for row navigation; existing default-path tests stay green unchanged.
- `TransactionDetailView.test.tsx`: new case asserting a custom `backHref` renders on the Back link; existing default-path test stays green unchanged.
- Any existing test on `open/[id]/page.tsx`'s approval-prop wiring (if one exists by the time this is implemented) gets updated to reflect that the route no longer computes real approval state.

## Open questions / risks

None outstanding — all decisions in this document were confirmed directly with the user during brainstorming.
