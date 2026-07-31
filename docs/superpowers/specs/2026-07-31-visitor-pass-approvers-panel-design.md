# Visitor Pass — List Approvers Panel (Part B, Visitor Pass only) — Design

## Context

The transaction line items plan (Part A, `docs/superpowers/plans/2026-07-28-transaction-line-items.md`) was explicitly decomposed to defer a "List Approvers" panel on the transaction detail page — displaying who's configured to approve a given transaction, sourced from the existing `MatrixTypeApprover` config table (built in the Matrix Type Approver setup round). That matching needs to be **scoped**: a transaction only matches approvers configured for the exact same Matrix Type + Department + Business Unit + Location combination.

Scoped matching requires the `Transaction` record to carry real foreign keys for all three — Department already exists (`departmentId`, populated today only by Visitor Pass), but Business Unit and Location do not: `originBusinessUnit` (Routing only) is a hardcoded string list, not linked to the real `BusinessUnit` table, and Visitor Pass's `visitLocation` is free text, not linked to the real `Location` table.

## Scope decision

This round covers **Visitor Pass only** — it already has a real Department dropdown, and location/business unit are the most natural fit conceptually for a visitor entry. The other 5 matrix types (Halfday, Undertime, Others, Out for Lunch, Routing) are explicitly deferred to a future round, decided per-type (e.g. Halfday likely doesn't need a Location at all).

Also explicitly out of scope, confirmed with the user:
- **No per-approver approval status** ("waiting for approval" / "approved" badges seen in a reference screenshot from an unrelated legacy system). That requires an actual approval-tracking data model tied to the still-unbuilt Post/approval workflow — a separate, larger future feature. This round shows only the **configured** list of who would approve, not live per-transaction status.
- No rollout to the other 5 matrix types.
- No changes to the Post/Delete-transaction buttons.

## Schema changes

- `Transaction` gains two new nullable FK columns, matching the existing `departmentId` pattern:
  - `businessUnitId String?` → `BusinessUnit`
  - `locationId String?` → `Location`
- The existing free-text `visitLocation` column is **kept, not dropped** — historical Visitor Pass transactions retain their original free-text value for display. New transactions stop writing to it; the header display falls back to `visitLocation` only when `locationId` is empty (i.e., only for pre-existing rows). No backfill-by-name-matching is attempted (too lossy/risky).
- `originBusinessUnit` (Routing's hardcoded-list field) is untouched by this round.

## Form changes (`app/(authenticated)/transactions/open/TransactionsView.tsx`)

- New required **Business Unit** dropdown added to Visitor Pass's field set, sourced from the real `BusinessUnit` table (same dropdown pattern as the existing Department field) — brand new field, Visitor Pass didn't collect this before.
- **Location** changes from a free-text `<input>` to a required `<select>` sourced from the real `Location` table — same visual position, same label.
- Both route through the existing `lib/transactionFieldSets.ts` `getActiveFields`/`findMissingRequiredField` pattern — no new validation mechanism, no duplicate required-field logic (matching this branch's established Global Constraint from the line-items plan).
- Field order (per approved mockup): Visitor Type, Planned Date, Planned Time, Person to Meet, Department, **Business Unit (new)**, **Location (now a dropdown)**, Reason, Transport Type, Plate No. — Business Unit and Location sit immediately after Department since all three feed the same approver lookup.

## Approver matching + query (`app/(authenticated)/transactions/open/[id]/page.tsx`)

- When the transaction's matrix type is "Visitor Pass" **and** `departmentId`, `businessUnitId`, and `locationId` are all set, query `MatrixTypeApprover` filtered by `matrixTypeId` + those three FKs (exact match on all three — scoped, not partial/wildcard), join the approver `User` for display name, group results by `level`.
- If matrix type isn't Visitor Pass, or any of the three FKs is missing (legacy transaction predating this feature, or a transaction whose combination simply has no configured approvers), the panel renders its empty state — this is a normal, expected outcome, not an error.

## Panel UI

Approved mockup: Option A (grouped, with avatars), placed as Option A (stacked below the line items table).

- A full-width white card, same shadow/rounding convention as the line items table, positioned directly below it.
- Header: "👤 List Approvers" with a total-count badge.
- Grouped by level ("1st Level", "2nd Level", "3rd Level" — only levels that have at least one approver render a sub-header), each with its own count.
- Each row: a circular initials avatar + the approver's full name. No status badge, no action buttons — display only.
- Empty state (no matrix type mismatch, just zero results): "No approvers configured for this Department + Business Unit + Location."
- Panel does not render at all for non-Visitor-Pass transactions (out of scope this round).

## Testing

Matching this branch's established conventions:
- `lib/validation/transaction.ts` / its test file: two new required-field cases (Business Unit, Location) added to the Visitor Pass schema, following the existing `findMissing*Field` pattern.
- `app/api/transactions/route.ts` tests: create persists the two new FKs; 400 with the specific message when either is missing (mirroring the existing Plate No./Department tests).
- `TransactionsView.test.tsx`: Business Unit and Location render as dropdowns for Visitor Pass, required-field validation messages, successful submission includes both.
- Detail page / panel tests: renders grouped by level with correct names for a matching combination; renders the empty state when no `MatrixTypeApprover` rows match; renders the empty state (not an error) when a transaction predates the feature (`businessUnitId`/`locationId` null); does not render at all for a non-Visitor-Pass transaction.

## Out of scope (recap)

- Per-approver live approval status/actions.
- Rollout to Halfday/Undertime/Others/Out for Lunch/Routing.
- Post/Delete-transaction button wiring.
- Backfilling `locationId`/`businessUnitId` on existing transactions.
