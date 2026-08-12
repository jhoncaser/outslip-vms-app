# Approval-Progress Status Display — Design

## Context

Round 3 from the original transaction-approval-workflow roadmap (flagged as future work when Round 1, the approve/revise/cancel engine, shipped): replace the flat status pill with real approval-progress text now that the engine (`getApprovalState`) and a real worklist (My Approvals, just shipped) both exist to build on.

Immediate trigger: live-testing surfaced that a fully-approved transaction's detail page showed both "Approved" (status text) and a separate green "POSTED" pill side by side — redundant, since approval can only happen after posting. Investigating the fix led to the fuller ask below, which also resolves that redundancy as a side effect.

## Requirements (confirmed with the user)

1. A transaction that's been created but not yet posted — regardless of whether it has line items — displays status **"Open"**, unchanged from today.
2. Once posted, status displays **"Waiting to be approved in 1st Level"** (then "2nd Level", "3rd Level", ...) reflecting whoever's turn it currently is, using the exact "1st Level"/"2nd Level"/"3rd Level" phrasing already established elsewhere on this branch (`TransactionDetailView.tsx`'s existing `LEVEL_LABELS`, `MatrixTypeApproverDetail.tsx`'s level grouping).
3. Once fully approved, status displays **"Approved"** alone.
4. The separate green "POSTED" pill is **removed entirely** — the new text is the sole status indicator. This also fixes the redundant-pill bug that prompted this round.
5. Cancelled transactions are unaffected — they display **"Cancelled"**, as today.

## Scope

Applies everywhere status is rendered: the Open Transactions list (`TransactionsTable`'s Status column) and the transaction detail page (`TransactionDetailView`'s Status field). Because `TransactionsTable`/`TransactionDetailView` are shared components, this automatically covers My Approvals' list and detail pages too (same components, same Status cell/field) — no separate work needed there. Canceled Transaction's page is unaffected in practice (it only ever shows `"Cancelled"`, which passes through unchanged) and needs no code change.

Out of scope: any change to the Open Transactions list's query (which matrix types/statuses it includes), the still-unbuilt Approved Transaction page, or anything about *how* approval state is computed — this round only changes what's displayed, reusing the existing `getApprovalState` engine unchanged.

## New helper — `lib/approvalStatusText.ts`

```
formatApprovalStatusText(statusName: string, pendingLevel: number | null): string
```

- If `statusName !== "Open"` or `pendingLevel === null`, returns `statusName` unchanged. This single branch correctly covers three cases at once: an unposted "Open" transaction (caller never even computed a pending level for it), a fully-"Approved" transaction (no pending level once the chain is exhausted), and a "Cancelled" transaction (falls straight through regardless of its `postedAt` value — cancelling can happen on an already-posted transaction, per the existing approver-cancel path, so `postedAt` alone is never a safe signal here).
- Otherwise returns `` `Waiting to be approved in ${LEVEL_LABEL}` `` where `LEVEL_LABEL` is `"1st Level"` / `"2nd Level"` / `"3rd Level"` for `pendingLevel` 1/2/3 (a small local map inside this new file — not shared with the pre-existing, separate `LEVEL_LABELS` copies in `TransactionDetailView.tsx`/`MatrixTypeApproverDetail.tsx`; refactoring those is unrelated pre-existing code, out of scope for this round).

This is the single source of truth for the display string — every consumer below calls it rather than re-deriving the wording.

## Consumers

**Open Transactions list (`app/(authenticated)/transactions/open/page.tsx`):** for each row where `postedAt !== null`, call the existing `getApprovalState(row.id)` to get `pendingLevel`, then `formatApprovalStatusText(row.status.name, pendingLevel)`. For unposted rows, skip the DB call entirely and pass `pendingLevel: null` directly (status is always `"Open"` pre-post, so the helper returns `"Open"` without needing real approval data). This is the same per-row-lookup pattern already accepted in `lib/myApprovals.ts` — acceptable at this app's scale, not something to optimize preemptively.

**Open Transaction detail (`app/(authenticated)/transactions/open/[id]/page.tsx`):** this file's `getApprovalState` call and computation were removed in the just-shipped My Approvals plan's cutover task (so Approve/Revise/Cancel stop rendering here). This round adds back a *minimal*, display-only version: when `postedAt !== null && status.name !== "Cancelled"`, call `getApprovalState(id)` and read `state.pendingLevel` — nothing else from that call is used. `isPendingApprover`/`isFinalApprovalLevel` are **not** reintroduced; `TransactionDetailView` keeps defaulting both to `false` on this route, so the action buttons stay gone exactly as the last round left them. This is a narrower re-add than what Task 6 removed, not a revert of it.

**My Approvals list (`app/(authenticated)/transactions/my-approvals/page.tsx`):** identical per-row pattern to the Open Transactions list.

**My Approvals detail (`app/(authenticated)/transactions/my-approvals/[id]/page.tsx`):** already computes a full `approvalState` (kept for the real Approve/Revise buttons) — this round just reads `pendingLevel` off the object already in scope. No new DB call.

**Canceled Transaction (`app/(authenticated)/transactions/canceled/page.tsx`):** untouched. Every row there has `status.name === "Cancelled"`, so even if it called the helper the result would be identical to today's plain `"Cancelled"` text — not worth adding the call for a no-op.

## Component changes

**`TransactionsTable` (`app/(authenticated)/transactions/open/TransactionsView.tsx`):** `TransactionRow` keeps its existing `statusName` field unchanged (other code may read it) and gains a new `statusDisplay: string` field (the pre-formatted text from the page). The Status `<td>` renders `<span className={pillClass("slate")}>{row.statusDisplay}</span>` only — the conditional `{row.postedAt && <span className={pillClass("green")}>POSTED</span>}` is deleted. `row.postedAt` itself stays on the type (still needed by the Post/Unpost button's own label logic in the Actions column) — only its use in the Status cell goes away.

**`TransactionDetailView` (`app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`):** `TransactionDetailData` keeps `statusName` unchanged and gains a new `statusDisplay: string` field, same split as above. The Status `<p>` renders `statusDisplay` alone; the `{isPosted && <span className={pillClass("green")}>POSTED</span>}` conditional is deleted. The `isPosted` local (`transaction.postedAt !== null`) stays — it's still used elsewhere in this large component (POSTED badge is gone, but `isPosted` also feeds `isLocked`, the Post/Unpost button label, etc.).

## Visual note

The new text is noticeably longer than the single-word states it replaces ("Open", "Approved", "Cancelled"). This spec keeps the existing pill styling (`pillClass("slate")`) for consistency and simplicity; if "Waiting to be approved in 1st Level" reads awkwardly as a pill once live, that's a fast follow-up polish pass, not a blocker to building this now — same iterate-after-seeing-it-live pattern already used repeatedly elsewhere on this branch.

## Testing

- `lib/approvalStatusText.test.ts` (new, plain unit test, no DB needed — pure function): unposted/no-pending-level → returns `statusName` as-is (covers "Open" pre-post); `pendingLevel` 1/2/3 with `statusName: "Open"` → the three exact "Waiting to be approved in Nth Level" strings; `statusName: "Approved"` with any `pendingLevel` value → returns `"Approved"` unchanged (fully-approved case, and also guards against a stale/inconsistent `pendingLevel` ever leaking through); `statusName: "Cancelled"` → returns `"Cancelled"` unchanged regardless of `pendingLevel`.
- `TransactionsView.test.tsx`: Status column renders `statusDisplay` text; the separate "POSTED" pill/text is asserted absent.
- `TransactionDetailView.test.tsx`: Status field renders the display text; the separate "POSTED" pill is asserted absent.

## Out of scope / deferred

- Restyling the pill for longer text (see Visual note above).
- Any change to which matrix types/statuses appear on the Open Transactions list, or building the still-unbuilt Approved Transaction page.
- Refactoring the two pre-existing, separate `LEVEL_LABELS`-style maps in `TransactionDetailView.tsx` and `MatrixTypeApproverDetail.tsx` to share the new helper's level-label map — unrelated pre-existing code, not touched by this round.
