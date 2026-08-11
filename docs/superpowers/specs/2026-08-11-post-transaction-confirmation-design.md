# Post Transaction Confirmation — Design Spec

**Date:** 2026-08-11
**Branch:** `green-rebrand`

## Goal

Replace the native browser `window.confirm()` popup shown when posting a transaction with a custom, dark-theme confirmation modal consistent with the rest of the app — matching the visual companion mockup the user picked (Option A: "Detail card").

## Background

Posting a transaction (both from the Open Transactions list and the transaction detail page) currently calls `window.confirm("Post this transaction? You won't be able to add, edit, or delete line items until you unpost it.")` before submitting. Unposting has never shown a confirmation and stays that way — this change only affects the "about to post" path.

This branch already built an equivalent custom confirmation for Delete (`components/dashboard/CancelTransactionModal.tsx`, shipped this session) — this spec reuses that exact visual language, recolored.

## Design

### New component: `components/dashboard/PostTransactionModal.tsx`

A near-mirror of `CancelTransactionModal.tsx`, green instead of red:

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, no backdrop-click/Escape dismissal — same explicit-button-only convention as every modal on this branch.
- Icon badge (📮) in a green-tinted circle, matching `pillClass("green")`'s color family.
- Title: "Post this transaction?"
- Detail box (code + matrix type name), same layout as `CancelTransactionModal`.
- Message: the existing warning copy verbatim — "You won't be able to add, edit, or delete line items until you unpost it." No "cannot be undone" language (unlike Cancel) — posting is reversible.
- Cancel (secondary) / Post (primary, green gradient matching `buttonPrimary`'s color) buttons, both disabled while `submitting`, Post shows "Posting…" while submitting.
- Error slot (`role="alert"`) inside the modal, shown when the confirm attempt fails — the modal stays open so the user can retry, matching how `CancelTransactionModal` handles its own errors.

Props: `{ transactionCode, matrixTypeName, submitting, error, onCancel, onConfirm }` — same shape as `CancelTransactionModal`, a pure controlled component with no internal state.

### Wiring — detail page (`TransactionDetailView.tsx`)

Today `handleTogglePosted` runs `window.confirm(...)` synchronously before the fetch, only when `!isPosted`. This becomes:

- New state: `showPostModal` (boolean). `postSubmitting`/`postError` are reused as-is — no rename.
- The POST/UNPOST button's `onClick` changes from `handleTogglePosted` directly to a new `handlePostButtonClick`: if not currently posted, open the modal (`setShowPostModal(true)`); if currently posted, call `handleTogglePosted()` immediately as today (unposting keeps its no-confirmation behavior, unchanged).
- `handleTogglePosted` drops its `window.confirm` block entirely and becomes the modal's `onConfirm`. On success it also closes the modal (`setShowPostModal(false)`) before `router.refresh()`. On failure, it leaves the modal open with `postError` set (no new closing logic needed — the modal already renders whenever `showPostModal` is true).
- Modal renders conditionally (`{showPostModal && <PostTransactionModal .../>}`) alongside the existing `CancelTransactionModal`/line-item-delete-modal renders at the end of the component.

### Wiring — list page (`TransactionsView.tsx`, `TransactionsTable`)

Same shape, per-row (mirrors how `cancelTarget` is already handled there):

- New state: `postModalTarget: TransactionRow | null`. `postingId`/`postError` are reused as-is.
- Each row's Post/Unpost button's `onClick`: if the row isn't currently posted, `setPostModalTarget(row)` (with `event.stopPropagation()`, same as the existing Delete button, so it doesn't also navigate to the detail page); if currently posted, call `handleTogglePosted(row)` immediately as today.
- `handleTogglePosted(row)` drops its `window.confirm` block, becomes the modal's `onConfirm` (reads the target row from `postModalTarget`, mirroring `handleConfirmCancel`'s use of `cancelTarget`). On success, clears `postModalTarget` before `router.refresh()`.
- Modal renders once, keyed off `postModalTarget`, alongside the existing `cancelTarget`-driven `CancelTransactionModal` render.

### Testing

Both files' existing tests that assert on `window.confirm` for the posting path (e.g. tests that stub/spy `window.confirm` to return true/false, or assert no confirm dialog appears when unposting) get rewritten to open the new modal, assert its content, and click Post/Cancel inside it — the same test-conversion pattern already used when Delete's own confirmation was built. Unposting's existing "no confirmation" tests are unaffected (that path doesn't change).

### Out of scope

- Delete's existing `CancelTransactionModal` is unchanged — the mockup review confirmed Option A specifically because it already matches Delete's style.
- Unposting gains no confirmation step (matches current behavior).
- No changes to the backend `PATCH /api/transactions/[id]` endpoint — this is a pure UI/state change against the already-shipped API.

## Execution

Same shape as the Cancel-modal work: three small SDD tasks (shared modal component → detail-page wiring → list-page wiring), each with its own task review, per-task check-in.
