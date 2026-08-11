# Transaction Approval Workflow (Round 1: Engine + Detail-Page Actions) — Design Spec

**Date:** 2026-08-11
**Branch:** `green-rebrand`

## Goal

Build the real multi-level approval workflow this app has deferred since the Matrix Type Approver config was first built (§3q/§3w/§3al/§3am/§3ao of the project handoff): once a transaction is posted, its configured approvers (resolved from `MatrixTypeApprover`, matched against the creator's own Department/Business Unit/Location) can **Approve**, **Revise**, or **Cancel** it, in strict level order.

This is Round 1 of three: the data model, the three backend actions, and enough UI (on the transaction detail page) to actually exercise them end to end. Two follow-on rounds, out of scope here:
- **Round 2:** the "My Approvals" dashboard worklist (tile already exists, gated to the Approver role — this round just needs to filter it to "transactions where it's currently my turn").
- **Round 3:** status display polish on the Open Transactions list page and the still-unbuilt "Approved Transaction" page.

## Background

- Posting already exists (`Transaction.postedAt`), deliberately kept separate from `Transaction.status` so status stays free for real approval stages later — this round is that "later."
- The approver chain for a transaction is already resolvable today via `lib/matchApprovers.ts`'s `findScopeMatchedApprovers({ matrixTypeId, departmentId, businessUnitId, locationId })`, called with the transaction's **creator's own profile** (not the transaction's own fields — an earlier deliberate redesign, §3ap). It currently returns `{ id, level, approverFirstName, approverLastName }` per configured level — no `approverId`, since the existing "List Approvers" panel only ever needed names for display.
- `MatrixTypeApprover` has a compound unique constraint on `(matrixTypeId, level, departmentId, businessUnitId, locationId)` — there is structurally always at most one approver per level for a given transaction. No "multiple approvers tied at the same level" case to handle.
- Approval must happen in strict level order (user-confirmed): a level-2 approver cannot act until level 1 has approved.

## Design

### Data model

```prisma
model TransactionApproval {
  id            String   @id @default(cuid())
  level         Int
  decidedAt     DateTime @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id])
  transactionId String

  approver   User   @relation(fields: [approverId], references: [id])
  approverId String

  @@unique([transactionId, level])
}
```

A row's mere existence means "this level approved this transaction" — no `decision` enum needed. Cancel never writes here (identical mechanism to today's cancel, see below). Revise never writes or deletes here either: because approval is strictly sequential, the current pending level by definition has no row yet, so there's nothing to remove. Revising a transaction just unposts it (see below) and leaves every already-approved level's row untouched — which is exactly the "only my level and above re-approve" behavior already agreed on, with zero extra logic required.

`Transaction` gains one nullable field:

```prisma
  revisionReason String?
```

Set by Revise, shown to the creator, cleared when they successfully re-Post (Task 2 of the plan wires this into the existing Post flow).

A new `TransactionStatus` row, `"Approved"`, seeded the same way `"Cancelled"` was (`prisma/seed.ts`'s `TRANSACTION_STATUSES` array). Set when the last configured level approves.

**Computed, not stored:** "which level is currently pending" for a transaction = the lowest level in its configured approver chain that has no `TransactionApproval` row yet. If the chain has zero configured approvers and the transaction is posted, it's treated as immediately fully approved — no level to wait for.

### `lib/matchApprovers.ts` extension

`ScopeMatchedApprover` gains `approverId: string` (the query already selects the `approver` relation for names; adding the id is a one-line change, additive, doesn't affect the existing List Approvers panel that already consumes this type).

### New helper: `lib/transactionApproval.ts`

A single function both the backend actions and the detail-page server component need:

```ts
export async function getApprovalState(transactionId: string): Promise<{
  chain: ScopeMatchedApprover[];       // full configured chain, already sorted by level
  approvedLevels: number[];            // levels with a TransactionApproval row, sorted
  pendingLevel: number | null;         // lowest un-approved configured level, or null if fully approved / no chain
  isFullyApproved: boolean;
}>
```

Looks up the transaction's `matrixTypeId` and creator's `departmentId`/`businessUnitId`/`locationId`, calls `findScopeMatchedApprovers`, then loads that transaction's `TransactionApproval` rows to compute `pendingLevel`/`isFullyApproved`. Centralizing this avoids the three new endpoints and the detail page each re-deriving "whose turn is it" independently and risking drift.

### Backend actions

Every approver-initiated action — Approve, Revise, or Cancel — is only reachable at all when the transaction is posted and it's genuinely that approver's turn (`postedAt !== null`, not cancelled, caller matches `approverId` at `pendingLevel`). An approver has no standing over a transaction that hasn't reached them yet: cancelling an unposted (still-draft) transaction stays creator-only, exactly as today.

**`POST /api/transactions/[id]/approve`** (no body)
- 401/404 as usual.
- 409 if not posted, or already cancelled, or already fully approved.
- 403 if the caller isn't the `approverId` at `pendingLevel` (via `getApprovalState`).
- Creates the `TransactionApproval` row for `pendingLevel`.
- If that was the chain's last level (or the chain becomes fully covered), sets `Transaction.statusId` to `"Approved"`.
- Returns `200` with `{ pendingLevel: number | null, isFullyApproved: boolean }`, matching the existing PATCH (Post/Unpost) endpoint's convention of returning the field(s) it just changed. The UI still uses `router.refresh()` afterward, same as every other action on this branch — the response body is for API-contract completeness and the endpoint's own tests, not consumed by the client this round.

**`POST /api/transactions/[id]/revise`** (`{ reason: string }`, non-empty)
- Same 401/404/409/403 gating as Approve (403 uses the same "current pending-level approver" check).
- 400 if `reason` is blank.
- Sets `Transaction.postedAt = null` and `Transaction.revisionReason = reason`. Writes nothing to `TransactionApproval` — see Data Model above for why nothing needs to be deleted.

**Cancel — extends the existing `DELETE /api/transactions/[id]`**
- Permission check becomes: allowed if `session.sub === transaction.creatorId` (unchanged) **or** the caller is the pending-level approver **on a currently-posted transaction** (new — an approver has no cancel rights over a transaction that hasn't reached them, i.e. still unposted).
- The existing `409` "unpost this transaction before deleting it" check is **only enforced for the creator's own cancel path**. An approver cancelling the posted transaction they're currently reviewing does so directly, in one action, without unposting first (user-confirmed: "once the approver cancels the transaction, it will be totally cancelled") — this is the one place approver-initiated cancel behaves differently from creator-initiated cancel.
- Sets the same `"Cancelled"` status as today either way, so an approver-cancelled transaction shows up on the Canceled Transactions page exactly like a creator-cancelled one, with no additional plumbing (user-confirmed).

### Detail-page UI (`TransactionDetailView.tsx` + `page.tsx`)

`page.tsx` computes `getApprovalState(transaction.id)` alongside its existing queries, derives `isPendingApprover = session?.sub === chain.find(a => a.level === pendingLevel)?.approverId`, and passes it down alongside the existing `isOwner`/`approvers` props.

When `isPendingApprover` is true (and the transaction is posted, not cancelled, not fully approved), three buttons render in the same button row as the existing Post/Unpost/Delete — **Approve**, **Revise**, **Cancel** — using the three modals approved in the visual companion session:
- **Approve modal** — green, mirrors `PostTransactionModal`'s structure. Copy reads "This moves the transaction to Level N+1 approval" or, on the final level, "This is the final approval — the transaction will be marked Approved."
- **Revise modal** — new component, amber-themed, adds a required reason textarea (shown to the creator via the new `revisionReason` field once rendered elsewhere — this round just captures and stores it; where the creator sees it is covered by wiring `revisionReason` into the existing detail-page header display, a small addition, not a new page).
- **Cancel modal** — no new component. The existing `CancelTransactionModal` is reused as-is; the detail page's existing Cancel button logic already calls `DELETE`, so an approver acting here goes through the exact same code path a creator's Cancel already does.

An approver's Approve/Revise/Cancel buttons and the creator's own Post/Unpost/Delete buttons are mutually exclusive in practice (a transaction only has one pending actor at a time — the creator before posting or during a revision, the pending-level approver once posted), but both sets of buttons are gated independently off their own boolean (`isOwner`/`isPendingApprover`) rather than one assuming the other's state, so the two roles' logic never has to know about each other.

### Testing

Real integration tests against the local Postgres test DB (matching every other route test on this branch) for all three new/changed endpoints: 401/404/409/403/success paths, plus the specific ordering rule (a level-2 approver's attempt to act before level 1 has approved gets 403, not silently succeeding). Component tests for the three new modal renders/wiring, following the exact pattern already proven for `PostTransactionModal`/`CancelTransactionModal`.

### Out of scope (this round)

- The "My Approvals" worklist page itself (Round 2) — the `getApprovalState` helper this round builds is exactly what that page's filtering query will reuse.
- Showing progressing status ("Pending Level 2 of 3") on the Open Transactions *list* page, or building out the "Approved Transaction" page (Round 3).
- Any notification (email, in-app) to the creator when a transaction is revised — the reason is stored and will be visible on the detail page, but nothing pushes it to them proactively.
- A history of multiple revisions — `revisionReason` is a single overwritable field, not a log. If this transaction gets revised twice before resubmission succeeds, only the latest reason is kept.
