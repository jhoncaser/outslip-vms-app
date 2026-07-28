# Transaction Line Items (Part A) — Design

**Date:** 2026-07-28
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, with visual companion mockups for the detail page layout, Add Line Item form, and line items table)

## Goal

Add a header/child ("mother and child") relationship between `Transaction` and a new `TransactionLineItem` table, so a transaction can hold one or more line items — either visitor entries (for "Visitor Pass" transactions) or employee/third-party/visitor entries (for every other matrix type). Clicking a transaction in the Open Transactions table navigates to a new detail page where line items are added, edited, and deleted.

## Scope

This is **Part A** of a two-part decomposition (see prior chat): line items only. **Part B** (displaying the configured `MatrixTypeApprover` list on the detail page, scoped by matching Department + Business Unit + Location) is a separate future round — it requires adding real Department/Business Unit/Location fields to every matrix type's transaction-creation flow, which today only Visitor Pass (Department) and Routing to other Business Unit (a free-text Business Unit, not linked to the real table) partially collect.

Also out of scope for this round, confirmed with the user:
- The "Post" button (status transition to a future "Posted" state) and the "Delete transaction" button — both visible in the reference screenshots' three-icon row, both deferred to a later round.
- The "Check IN / Check OUT Movement Transaction Log" panel seen in the reference screenshot — an unrelated guard-desk feature.
- An `employeeId` field on `User` (the reference's "1222870 - Jhon Niño Caser" format) — skipped for now; the Name dropdown for Mega Employee shows "First Last" only. Adding a real employee ID is a future enhancement to Register/Edit User, not this feature.
- Editing/deleting whole transactions from this page.

## Design

### 1. Data model

One new table, following the same "one table, nullable variant-specific columns" convention the `Transaction` header itself already uses for its own Visitor-Pass-only fields:

```prisma
model TransactionLineItem {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  transactionId String

  // Visitor Pass variant
  visitorName    String?
  jobTitle       String?
  company        String?
  contactNumber  String?
  emailAddress   String?
  uploadFileUrl  String?
  uploadFileName String?
  transportType  String?

  // Every other matrix type ("employee" variant)
  employeeType String?  // "Mega Employee" | "Third-Party" | "Visitor"
  employee     User?    @relation(fields: [employeeId], references: [id])
  employeeId   String?
  name         String?  // free text, Third-Party/Visitor only
  remarks      String?
}
```

- `Transaction` gains a back-relation: `lineItems TransactionLineItem[]`.
- `User` gains a back-relation: `lineItemAssignments TransactionLineItem[]`.
- Job Position, Department, and Business Unit are **never stored** on the line item for Mega Employee — they're looked up live through the `employee` relation at render/query time (`employee.jobTitle`, `employee.department.name`, `employee.businessUnit.name`), so they can't drift from the actual User record.
- One additive migration (new table + two new relations on existing models), applied to the live Neon dev DB the same way every prior schema change on this branch has been.

### 2. File uploads

No existing upload infrastructure in this codebase today (confirmed via a search for `multipart`/`FormData`/cloud-storage usage — none found). Decisions:

- **Storage:** local disk, in a new `uploads/line-items/` directory at the project root (gitignored — add to `.gitignore`), created on first write if it doesn't exist. Chosen over cloud storage since there's no known production hosting target yet; revisit if/when one is picked.
- **Not under `public/`:** uploaded files may contain visitor ID scans or company documents. `public/` assets are served with no auth check at all (as the branch already learned the hard way with `proxy.ts`'s matcher, §5's gotchas). Instead, files are served through a new authenticated route, `GET /api/line-items/[lineItemId]/file`, which checks the session cookie before streaming the file from disk.
- **Filename handling:** generate a unique on-disk filename (`${cuid()}-${sanitized-original-name}`) to avoid collisions; store both the generated path (`uploadFileUrl`) and the original filename (`uploadFileName`) for display (e.g. "📎 id.pdf").
- **Validation:** accept images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`), `application/pdf`, and Word docs (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`); reject anything else with a clear error. Cap size at 5MB.
- **Cleanup:** deleting a line item also best-effort-deletes its file from disk (ignore errors — a leftover orphan file is a much smaller problem than a failed delete). Editing a line item to replace its file saves the new file and updates the DB record first, then best-effort-deletes the old file — never the other order, so a mid-failure never leaves the record pointing at nothing.
- **No new dependency:** Next.js route handlers parse `multipart/form-data` natively via `request.formData()`, so no upload library is needed.

### 3. Required fields per variant

Matches the approved mockups exactly.

**Visitor Pass line item** — required: Visitor Name, Job Title, Company, Transport Type. Optional: Contact #, Email Address (validated as a real email format only when provided), Upload File.

**Employee line item** (every other matrix type) — required: Employee Type (always), then:
- **Mega Employee:** Name (the User picked from the dropdown) required. Remarks required.
- **Third-Party / Visitor:** Name (free text) required. Remarks required.
- Job Position/Department/Business Unit are never required (they're derived, not entered).

Enforced both client-side (fast feedback, same specific-message convention as the header's required-field work) and server-side (the real gate) — matching the just-shipped header pattern exactly.

**Remarks default:** when the Add Line Item form opens, Remarks pre-fills from the transaction header's `reason` field (labeled "Reason" at the header, "Remarks" at the line-item level — same underlying value, different display label) — but it's a normal editable text input from that point on, not a live read-only lookup. Once saved, a line item's `remarks` is its own independent value; later edits to the header's `reason` do not retroactively change already-saved line items.

### 4. API routes

- **`POST /api/transactions/[id]/line-items`** — creates a line item. Request is `multipart/form-data` (to carry the optional file). Looks up the parent transaction's `matrixType.name` to decide which schema applies (`"Visitor Pass"` → the Visitor Pass schema, anything else → the employee schema), validates, saves the file if present, creates the row.
- **`PATCH /api/transactions/[id]/line-items/[lineItemId]`** — edits a line item. Also `multipart/form-data`; omitting the file field keeps the existing one, providing a new file replaces it (old file deleted after the DB update succeeds, per the cleanup rule above).
- **`DELETE /api/transactions/[id]/line-items/[lineItemId]`** — deletes the row and best-effort-deletes its file.
- **`GET /api/line-items/[lineItemId]/file`** — authenticated file-serving route (401 if no session), streams the file with its original content-type.
- No new `GET` route for listing line items — the detail page (server component) queries Prisma directly for its initial render, matching every other page in this app.

All four routes follow the existing `verifySessionToken` → 401-if-missing pattern; no additional permission gate (matches `dashboard/page.tsx`/`transactions/open/page.tsx`'s existing "no explicit gate, the whole route group is already protected" convention) — filing/editing/deleting line items is available to any authenticated user, same as filing the transaction itself.

### 5. Transaction detail page

New route: `app/(authenticated)/transactions/open/[id]/page.tsx` (server component) — fetches the transaction (404 via `notFound()` if missing) plus its `lineItems` (including the `employee` relation for Mega Employee display), passes both to a new client component, `TransactionDetailView.tsx`.

Layout (per the approved mockup, **Option B — standalone page**, not a persistent master-detail split, matching how Settings/Register Users already work on this branch):

- A "← Back to Open Transactions" link.
- A header card: QR code, transaction code, and the same populated-header-fields display the table's row-expand used to show (Planned Date, Reason, etc., dash-skipped for unset ones) — this logic moves here from `TransactionsTable`'s soon-to-be-removed expand panel.
- "Employee/Visitor Lists (`N`)" section: a table (columns differ by variant, per the approved mockup) with a "+ Add Line Item" button, and a pencil/trash action pair per row.
- Add/Edit Line Item modal — same component for both actions (props decide create-vs-edit, matching the existing `RegistrationWizard` add/edit convention), rendering the Visitor Pass or employee field set depending on the parent transaction's matrix type, exactly as mocked up (Employee Type as a 3-way button group, not a dropdown; Mega Employee's Job Position/Department/Business Unit shown as disabled/greyed display text, Business Unit as a pill).
- Delete: a native `window.confirm("Delete this line item?")` before calling the delete route — no new confirmation modal, per the approved recommendation (revisit if a fancier confirmation is wanted later).

### 6. Open Transactions table changes

`TransactionsTable` (in `TransactionsView.tsx`) currently expands a row in place on click (`expandedCode` state, chevron rotate, `transactionDetailFields()` helper formatting the extra fields). This is replaced with real navigation: clicking a row (outside the QR thumbnail, which keeps its existing `stopPropagation` + enlarge-dialog behavior unchanged) navigates to `/transactions/open/[id]`. The expand-in-place state, the rotating chevron, and `transactionDetailFields()` are removed from this file — the field-formatting logic they did moves to the new detail page instead (§5), it isn't deleted outright.

The Add Transaction modal/form itself (`TransactionsView`'s create flow) is untouched — this round only changes what happens when you click an existing row.

### 7. Testing

- `lib/validation/transactionLineItem.test.ts` — both schemas: required-field rejection with specific messages, email format validation, Mega Employee vs. Third-Party/Visitor branching.
- `app/api/transactions/[id]/line-items/route.test.ts` — POST: 401/400 (missing required)/201 for both variants, file upload persists correctly, Mega Employee `employeeId` round-trips.
- `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts` — PATCH (field edits, file replacement, old file cleanup) and DELETE (row removed, file removed).
- `app/api/line-items/[lineItemId]/file/route.test.ts` — 401 without session, 200 with correct content-type when authenticated.
- `TransactionDetailView.test.tsx` — renders the header card and the correct table shape per variant; Add Line Item modal shows the right fields and enforces required-ness; Edit pre-fills; Delete calls the DELETE route after confirm.
- `TransactionsView.test.tsx` — updated: row click now asserts navigation (via the mocked `useRouter`) instead of expand/collapse; the removed expand-panel tests are deleted, not left stale.

## Out of scope

- Part B (List Approvers display) — separate future round, needs Department/Business Unit/Location added to transaction creation for every matrix type first.
- Post/Delete-transaction buttons.
- Check IN/Check OUT movement log.
- `employeeId` on `User`.
- Editing the transaction header itself from this page.
