# Line Item Delete Confirmation Modal — Design

## Context

The transaction detail page's line items table (`app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`) currently confirms deletion with a native `window.confirm("Delete this line item?")` popup — a deliberately minimal choice made when delete-anything first shipped in this app (Part A of the transaction-line-items plan). The user asked to replace it with a custom modal so the row being deleted is visibly identified before the user confirms, instead of having to scroll back to check.

## Goal

Replace the native `confirm()` call with a custom modal that:
1. Matches this branch's established modal chrome and behavior conventions.
2. Shows enough of the target row's own data that the user doesn't need to re-check the table before confirming.
3. Keeps the same underlying delete request and success/failure handling this app already has, just re-homed into the new modal.

## Visual design

Brainstormed with the visual companion (session `1928-1785483165`, port 52903, `delete-modal-styles.html`) — 4 options shown (minimal text-only, icon + name, detail card, compact). User picked **Option C — detail card**, specifically because it shows the row's own details inline rather than requiring a second look at the table.

Modal chrome matches every existing modal on this branch: `fixed inset-0 z-50` overlay, `bg-slate-900/35` backdrop, white rounded-xl card, centered. **No backdrop-click or Escape dismissal** — this branch's modals are deliberately explicit-button-only, and this one follows the same rule (confirmed with the user rather than assumed).

Card contents, top to bottom:
- A red circular badge with a ⚠️ warning glyph (reusing the app's existing emoji-icon convention for this row's own action buttons, not a new Feather SVG)
- Title: "Delete this line item?"
- A detail card (light gray background, rounded, left-aligned) showing the target row's identifying info — see "Detail card content" below
- Caption: "This action cannot be undone."
- Cancel button (light gray) and Delete button (red), side by side, equal width

## Detail card content

Two variants, matching the two line-item variants this table already renders:

- **Visitor Pass** (`variant === "visitor-pass"`): bold **Visitor Name** on the first line, a lighter meta line below reading `${Job Title} · ${Company}`.
- **Employee variant** (`variant === "employee"`, used by every other matrix type): bold `${Employee Type} — ${Name}` on a single line (e.g. "Mega Employee — Jhon Niño Caser"), no meta line — Job Position/Department/Business Unit are secondary lookup fields, not identifying ones, and are intentionally omitted here.

## Behavior

- Clicking a row's 🗑️ Delete button no longer calls `handleDelete` directly. It instead opens the delete-confirmation modal, holding a reference to the target `LineItemRow`.
- **Cancel** closes the modal with no network request.
- **Delete** sends the same `DELETE /api/transactions/{transaction.id}/line-items/{lineItemId}` request the app already sends today (no route/API change — this is a client-side-only change).
  - On success: modal closes, `router.refresh()` runs, same as today.
  - On failure: the error message (from the API's `{error: "..."}` body, or a generic fallback) renders **inside the modal**, which stays open so the user can retry Delete or back out via Cancel. This replaces today's above-the-table `deleteError` banner — the Add/Edit modal already handles its own errors this way (in-modal, not a page-level banner), so this brings delete in line with that existing pattern instead of introducing a second convention.
- A loading state on the Delete button (disabled + label change, e.g. "Deleting…") while the request is in flight, mirroring the Add/Edit modal's `submitting` state.

## Out of scope

- No change to the Add/Edit Line Item modal or its behavior.
- No change to the DELETE API route itself (`app/api/transactions/[id]/line-items/[lineItemId]/route.ts`) — this is purely a client-side UX change.
- No confirmation-modal-as-a-shared-component extraction. This is the first non-native delete-confirmation modal in the app; if a second one is ever needed, extracting a shared component becomes worth revisiting then, not now (YAGNI).

## Testing

The existing test `"deletes a line item after confirming, and not when the confirm is declined"` (which stubs `window.confirm`) is removed and replaced with modal-based coverage:
- Clicking Delete opens the modal, showing the correct detail-card content for a Visitor Pass row.
- Clicking Delete opens the modal, showing the correct detail-card content for an employee-variant row (both a Third-Party/Visitor-style row and a Mega Employee row, since the label format differs only in the `${Type} — ${Name}` string, not in data source).
- Clicking Cancel closes the modal and does not call `fetch`.
- Clicking Delete (confirm) inside the modal calls `DELETE` with the correct URL, closes the modal, and triggers `router.refresh()` on success.
- A failed delete (mocked non-ok response) shows the error message inside the modal and leaves it open (not closed, not navigated away).
- A regression test confirms a real backdrop click and a real Escape keydown do **not** close the modal — matching the existing regression-test pattern already used for the QR-enlarge modal and the Add/Edit modal on this branch.
