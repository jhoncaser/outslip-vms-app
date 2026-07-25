# Visitor Pass Matrix-Type Fields — Design

**Date:** 2026-07-25
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, text-only)

## Goal

The Add Transaction form and Open Transactions table currently show one fixed set of optional fields regardless of which Matrix Type is selected (Planned Date, Planned Time, Return Time, Origin Business Unit, Enroute to Other Business Unit, Reason). When the user selects the **"Visitor Pass"** matrix type specifically, the form should swap to a different, Visitor-Pass-specific field set instead of showing the generic one.

## Scope

- Only the `"Visitor Pass"` matrix type (matched by name) gets a custom field set. Every other matrix type keeps today's form and table exactly as-is.
- All new fields stay **optional** — no client- or server-side required-field enforcement, matching how the existing optional fields behave today.
- No new matrix-type-specific field sets are being built for other matrix types in this round — this is a single, concrete swap for Visitor Pass. If more matrix types need their own field sets later, that's a future round.

## Design

### 1. Data model

Add 6 new nullable columns to `Transaction`. Planned Date, Planned Time, and Reason are **reused** as-is (no schema change) since Visitor Pass shares them with the generic field set.

```prisma
model Transaction {
  // ...existing fields unchanged...

  visitorType    String?
  personToMeet   String?

  department   Department? @relation(fields: [departmentId], references: [id])
  departmentId String?

  visitLocation  String?
  transportType  String?
  plateNo        String?
}
```

- `department`/`departmentId` — real FK to the existing `Department` table (ICT, HROD, Accounting, Treasury, Admin), the same pattern `MatrixTypeApprover.departmentId` already uses. `Department` gains a back-relation: `transactions Transaction[]`.
- `visitLocation` — free text. The UI label is **"Location"**, but the Prisma/API field is named `visitLocation` rather than `location` to avoid confusion with the existing `Location` reference table (a dropdown of Zamboanga/Manila/etc., used by `User`/`MatrixTypeApprover`). This is a different, free-text concept — the specific venue for the visit — not a link to that table.
- `visitorType` — fixed list, not a DB-backed table: Applicant, Buyer, Contractor, Supplier, Visitor.
- `transportType` — fixed list, not a DB-backed table: Car, Truck, Bicycle, Motorcycle, Walk-In.
- Two new option-list files, matching the existing `lib/businessUnitOptions.ts` convention:
  - `lib/visitorTypeOptions.ts` — `VISITOR_TYPE_OPTIONS`
  - `lib/transportTypeOptions.ts` — `TRANSPORT_TYPE_OPTIONS`
- One additive Prisma migration (nullable columns + FK, no backfill) applied to the live Neon dev DB via `npx prisma migrate dev`, same process as every prior schema change on this branch.

### 2. Add Transaction modal — field-set swap

`app/(authenticated)/transactions/open/TransactionsView.tsx` computes, from the already-available `matrixTypes` prop, whether the selected matrix type's `name` is exactly `"Visitor Pass"`:

```ts
const isVisitorPass =
  matrixTypes.find((m) => m.id === matrixTypeId)?.name === "Visitor Pass";
```

**When `isVisitorPass` is true:**
- Hidden: Return Time, Origin Business Unit, Enroute to Other Business Unit.
- Shown, in this order: Visitor Type, Planned Date, Planned Time, Person to Meet, Department, Reason, Location, Transport Type, Plate No.

**Otherwise:** today's form, unchanged (Planned Date, Planned Time, Return Time, Origin Business Unit, Enroute to Other Business Unit, Reason).

New fields:
- **Visitor Type** — `<select>`, options from `VISITOR_TYPE_OPTIONS`.
- **Person to Meet** — free-text `<input>`.
- **Department** — `<select>`, options from the new `departments` prop (`{ id, name }[]`, passed down from `page.tsx`, same shape as `businessUnits`/`locations` elsewhere in the app).
- **Location** — free-text `<input>` (maps to `visitLocation`).
- **Transport Type** — `<select>`, options from `TRANSPORT_TYPE_OPTIONS`.
- **Plate No.** — free-text `<input>`.

All optional. Submission follows the existing `if (value) body.field = value;` guard pattern per field — no explicit `isVisitorPass` branch needed at submit time, since the Visitor-Pass-only fields simply stay empty when hidden.

### 3. Open Transactions table

`TransactionsTable` in the same file gains 6 new columns — **Visitor Type, Person to Meet, Department, Location, Transport Type, Plate No.** — inserted after the existing **Reason** column and before **Created By**, grouped together as the "type-specific detail" block. Non-Visitor-Pass rows show `"—"`, matching how Origin Business Unit and Reason already render when unset.

### 4. Data flow

`app/(authenticated)/transactions/open/page.tsx` gains:
- `prisma.department.findMany({ orderBy: { name: "asc" } })` added to the existing `Promise.all`, passed to `TransactionsView` as a new `departments` prop.
- `transactions.findMany`'s `include` gains `department: { select: { name: true } }`.
- `transactionRows` mapping gains the 6 new display fields, each falling back to `"—"` when null (same convention as `originBusinessUnit`/`reason` today):
  - `visitorType: row.visitorType ?? "—"`
  - `personToMeet: row.personToMeet ?? "—"`
  - `department: row.department?.name ?? "—"`
  - `location: row.visitLocation ?? "—"`
  - `transportType: row.transportType ?? "—"`
  - `plateNo: row.plateNo ?? "—"`

### 5. API: `POST /api/transactions`

- `lib/validation/transaction.ts` gains 6 new optional fields: `visitorType` (`z.enum(VISITOR_TYPE_OPTIONS).optional()`), `personToMeet` (`z.string().optional()`), `departmentId` (`z.string().optional()`), `visitLocation` (`z.string().optional()`), `transportType` (`z.enum(TRANSPORT_TYPE_OPTIONS).optional()`), `plateNo` (`z.string().optional()`).
- `app/api/transactions/route.ts` passes each straight into `prisma.transaction.create()`'s `data`, same pattern as the existing optional fields.
- `departmentId` is a second optional FK on this route (alongside `matrixTypeId`). The existing `P2003` handler is left untouched — it returns the existing `"Invalid transaction type"` 400 message for any FK failure. This matches the precedent already set by `app/api/matrix-type-approvers/route.ts`, which has five possible FKs and deliberately returns one generic `"Invalid reference"` message for all of them rather than discriminating by field name (Prisma's P2003 `meta` shape for field-name discrimination isn't reliable enough to build on). Not worth a schema-fragile special case for an edge case only reachable via a malformed direct API call, not through the UI (the dropdown only ever submits real department IDs).

### 6. Testing

Extends existing test files (no new test files):
- `lib/validation/transaction.test.ts` — accepts the 6 new optional fields; rejects invalid `visitorType`/`transportType` enum values.
- `app/api/transactions/route.test.ts` — persists Visitor Pass fields when provided.
- `TransactionsView.test.tsx` — selecting "Visitor Pass" hides Return Time/Origin Business Unit/Enroute to Other Business Unit and shows the 9-field set in order; selecting any other matrix type keeps today's fields; submits populated Visitor Pass fields in the request body; table renders the 6 new columns with `"—"` fallback for non-Visitor-Pass rows.

## Out of scope

- Required-field enforcement for Visitor Pass fields — explicitly declined by the user; everything stays optional.
- Custom field sets for any other matrix type (Halfday, Undertime, Routing to other Business Unit, Out for Lunch, Others) — only Visitor Pass is being special-cased this round.
- A generalized "field schema per matrix type" configuration system — would be over-engineering for a single concrete field set; YAGNI unless a second matrix type needs its own fields later.
- Renaming/reconciling `visitLocation` to reuse the existing `Location` reference table — deliberately kept as free text per the user's original field list ("Location (free text)").
