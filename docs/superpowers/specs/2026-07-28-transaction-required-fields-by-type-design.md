# Transaction Required Fields by Matrix Type — Design

**Date:** 2026-07-28
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, text-only)

## Goal

The Add Transaction form currently shows one fixed, all-optional field set for every matrix type except "Visitor Pass" (which already has its own custom field set from a prior round, §3ad). This round defines, for **every** matrix type, exactly which fields are shown — and makes those shown fields **required** (both client- and server-side). No new fields or database columns; every field involved is already reused from the existing pool.

## Scope

Matrix type → required fields, per the user's specification:

| Matrix Type | Required fields |
|---|---|
| Halfday | Planned Date, Planned Time, Reason |
| Undertime | Planned Date, Planned Time, Reason |
| Others | Planned Date, Planned Time, Reason |
| Out for Lunch | Planned Date, Planned Time, Return Time, Reason |
| Routing to other Business Unit | Planned Date, Planned Time, Origin Business Unit, Enroute to Other Business Unit, Reason |
| Visitor Pass | Visitor Type, Planned Date, Planned Time, Person to Meet, Department, Reason, Location, Transport Type, Plate No. |

- "Shown" and "required" are the same set for every type in this round — there is no field that's shown-but-optional.
- Field **order** within each type follows the existing canonical field order already in the code (Planned Date, Planned Time, Return Time, Origin Business Unit, Enroute to Other Business Unit, Reason for the reusable pool; Visitor Pass keeps its current 9-field order exactly as coded today). This is not necessarily the order fields were listed in chat.
- Visitor Pass's field *list* doesn't change from what's already implemented — only its required-ness does.
- Out of scope: any new fields/columns, and any change to the Open Transactions table's columns (it already shows only populated fields per row via its expandable detail panel, so it adapts automatically).

## Design

### 1. Shared field-set config — `lib/transactionFieldSets.ts` (new file)

Single source of truth, imported by both the client form and the API route:

```ts
export type TransactionFieldKey =
  | "plannedDate"
  | "plannedTime"
  | "returnTime"
  | "originBusinessUnit"
  | "enrouteBusinessUnits"
  | "reason"
  | "visitorType"
  | "personToMeet"
  | "departmentId"
  | "visitLocation"
  | "transportType"
  | "plateNo";

export const TRANSACTION_FIELD_SETS: Record<string, readonly TransactionFieldKey[]> = {
  "Halfday": ["plannedDate", "plannedTime", "reason"],
  "Undertime": ["plannedDate", "plannedTime", "reason"],
  "Others": ["plannedDate", "plannedTime", "reason"],
  "Out for Lunch": ["plannedDate", "plannedTime", "returnTime", "reason"],
  "Routing to other Business Unit": [
    "plannedDate", "plannedTime", "originBusinessUnit", "enrouteBusinessUnits", "reason",
  ],
  "Visitor Pass": [
    "visitorType", "plannedDate", "plannedTime", "personToMeet",
    "departmentId", "reason", "visitLocation", "transportType", "plateNo",
  ],
};

export const TRANSACTION_FIELD_LABELS: Record<TransactionFieldKey, string> = {
  plannedDate: "Planned Date",
  plannedTime: "Planned Time",
  returnTime: "Return Time",
  originBusinessUnit: "Origin Business Unit",
  enrouteBusinessUnits: "Enroute to Other Business Unit",
  reason: "Reason",
  visitorType: "Visitor Type",
  personToMeet: "Person to Meet",
  departmentId: "Department",
  visitLocation: "Location",
  transportType: "Transport Type",
  plateNo: "Plate No.",
};
```

Also exports a shared helper used by both client and server to find the first missing required field for a given matrix type name and submitted values:

```ts
export function findMissingRequiredField(
  matrixTypeName: string,
  values: Partial<Record<TransactionFieldKey, string | string[] | undefined>>
): TransactionFieldKey | null {
  const required = TRANSACTION_FIELD_SETS[matrixTypeName] ?? [];
  for (const key of required) {
    const value = values[key];
    const isEmpty = key === "enrouteBusinessUnits"
      ? !Array.isArray(value) || value.length === 0
      : !value || value.trim() === "";
    if (isEmpty) return key;
  }
  return null;
}
```

**Fallback for unknown matrix types:** Matrix Types are admin-managed (Settings allows adding new ones). If a matrix type's name isn't in `TRANSACTION_FIELD_SETS` (e.g. a new one added after this round), it gets **zero required fields** — `?? []` above — matching "no extra fields shown" rather than inventing a rule or crashing. This can be revisited when/if a new matrix type needs its own field set defined.

### 2. Add Transaction form (`TransactionsView.tsx`)

Replaces today's `isVisitorPass` ternary with one data-driven render:

- `const selectedTypeName = matrixTypes.find((m) => m.id === matrixTypeId)?.name;`
- `const activeFields = selectedTypeName ? TRANSACTION_FIELD_SETS[selectedTypeName] ?? [] : [];`
- Until a type is selected, `activeFields` is empty — the form shows only the Transaction Type dropdown.
- Once selected, the form renders each key in `activeFields` via a small per-key switch (reusing the existing input JSX for each field, just no longer split into two hardcoded branches) — same visual field order as today for the fields that already exist in either branch.
- **Client-side pre-submit check:** before calling the API, run `findMissingRequiredField(selectedTypeName, currentFormValues)`. If it returns a key, set the existing `error` state to `` `${TRANSACTION_FIELD_LABELS[key]} is required for this transaction type` `` and return without submitting (reuses the existing `role="alert"` error slot — no new UI). No native HTML `required` attributes, since the Enroute checkbox group can't express "at least one" that way and mixing native + custom validation would be inconsistent.
- Submission body: only include keys present in `activeFields` for the selected type (extending today's existing `if (value) body.field = value` guards, scoped to the active set) — fields for a non-selected type are never sent, same "hidden means hidden" principle already established for Visitor Pass in §3ad's leak fix.
- Origin Business Unit's existing auto-fill-from-user's-business-unit behavior (§3ac) is unaffected — it still pre-fills on modal open; it's simply only visible/submitted when "Routing to other Business Unit" is the active type.

### 3. Server-side enforcement (`app/api/transactions/route.ts`)

Before creating the transaction:

1. Look up the matrix type's name: `const matrixType = await prisma.matrixType.findUnique({ where: { id: parsed.data.matrixTypeId }, select: { name: true } });`
2. If not found, return the existing `400 "Invalid transaction type"` (matches today's behavior for a bad ID, just checked earlier/explicitly instead of relying on the P2003 catch).
3. Otherwise, call `findMissingRequiredField(matrixType.name, parsed.data)`. If it returns a key, return `400` with `{ error: \`${TRANSACTION_FIELD_LABELS[key]} is required for this transaction type\` }` — matching the specific-message convention already established for change-password validation (§3f).
4. Only if both checks pass, proceed with the existing transaction-code retry-create loop, unchanged.

This is the real gate; the client-side check in §2 exists only to avoid an unnecessary round-trip and give faster feedback.

### 4. Testing

Extends existing test files (no new test files):

- `lib/transactionFieldSets.test.ts` (new, small) — `findMissingRequiredField` returns the correct first-missing key per type, `null` when all required fields are present, and `null` (no requirements) for an unrecognized type name.
- `TransactionsView.test.tsx` — for a couple of representative types (e.g. Halfday and Routing to other Business Unit): selecting the type shows exactly its required fields; submitting with a required field empty shows the specific error and does not call the API; filling all required fields submits successfully. Visitor Pass's existing tests are updated only to reflect that its fields are now required (same fields, same order).
- `app/api/transactions/route.test.ts` — rejects with the specific message when a required field is missing for the selected type; succeeds when all are present; a matrix type not in the config (if one exists in the test DB) requires nothing beyond the type itself.

## Out of scope

- Any new fields, columns, or matrix types.
- Table column changes (already adapts automatically via its existing "only show populated fields" detail panel).
- A UI affordance in Settings for admins to define a new matrix type's required fields — for now, `TRANSACTION_FIELD_SETS` is a code-level config; a matrix type without an entry simply requires nothing extra. Building an admin-editable version of this config is a future round if needed.
