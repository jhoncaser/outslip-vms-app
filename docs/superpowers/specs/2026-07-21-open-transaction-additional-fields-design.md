# Open Transaction — Additional Fields (Round 2)

**Date:** 2026-07-21
**Branch:** `green-rebrand`
**Status:** Approved by user (text-only clarification, no visual companion needed — field types/values were fully specified directly)

## Goal

Extend the Add Transaction form (built in the original `2026-07-21-open-transaction-design.md` round) with six new fields, per the user's explicit list: Return Time, Planned Date, Planned Time, Reason, Origin Business Unit, Enroute to Other Business Unit. This is the "later round" that the original spec's "Explicitly declined / out of scope" section anticipated.

**Scope note (inferred, not explicitly stated by the user — flag if wrong):** only the Add Transaction **form** and the underlying `Transaction` **data model** change. The Open Transaction **list/table view** stays exactly as it is today (Code, Transaction Type, Created By, Status, Date Filed) — the six new fields are captured and stored, but not yet surfaced as new table columns. Adding them to the table view is a separate future decision.

## Current state

`Transaction` (from the original round) has: `id`, `transactionCode`, `createdAt`, `matrixTypeId`, `statusId`, `creatorId`. The Add Transaction modal has a single field, Transaction Type (`matrixTypeId`).

## Design

### 1. Field list

All six fields are **optional** (explicit user decision — "consider that all fields are not required").

| Field | Prisma type | Form control | Values |
|---|---|---|---|
| Planned Date | `DateTime? @db.Date` | `<input type="date">` | — |
| Planned Time | `DateTime? @db.Time` | `<input type="time">` | — |
| Return Time | `DateTime? @db.Time` | `<input type="time">` | — |
| Origin Business Unit | `String?` | `<select>` (single) | Alpha, Ayala, Camacop, Cawit, Cocoland, Delta, Others, Patalon, Prime, Talisayan |
| Enroute to Other Business Unit | `String[]` (`@default([])`) | `<select multiple>` (native, no new component/library) | same 10 values as Origin |
| Reason | `String?` | `<textarea>` | — |

**Important — these are NOT linked to the existing `BusinessUnit` Prisma model.** The user explicitly declined that: "no need to use or link the existing table Business Unit. do it just a normal dropdown option." The 10 values are a fixed, hardcoded list local to this feature, unrelated to the `BusinessUnit` reference table used elsewhere (registration, Settings). A shared constant (`BUSINESS_UNIT_OPTIONS`, alphabetically sorted, matching the user's explicit request for alphabetical order) is defined once and used by both the Zod schema and the form's `<select>` options — same "extract once, share between validation and UI" pattern already used for `ROLES`/`ROLE_LABELS` in `lib/roles.ts`.

Field order in the form, after the existing Transaction Type dropdown: Planned Date → Planned Time → Return Time → Origin Business Unit → Enroute to Other Business Unit → Reason.

### 2. Data model — `prisma/schema.prisma`

Add to the existing `Transaction` model:

```prisma
  plannedDate           DateTime? @db.Date
  plannedTime           DateTime? @db.Time
  returnTime            DateTime? @db.Time
  originBusinessUnit    String?
  enrouteBusinessUnits  String[]  @default([])
  reason                String?
```

### 3. Shared business unit options constant — `lib/businessUnitOptions.ts` (new file)

```ts
export const BUSINESS_UNIT_OPTIONS = [
  "Alpha",
  "Ayala",
  "Camacop",
  "Cawit",
  "Cocoland",
  "Delta",
  "Others",
  "Patalon",
  "Prime",
  "Talisayan",
] as const;
```

### 4. Validation — `lib/validation/transaction.ts` (extend existing `transactionSchema`)

```ts
import { z } from "zod";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedTime: z.string().optional(),
  returnTime: z.string().optional(),
  originBusinessUnit: z.enum(BUSINESS_UNIT_OPTIONS).optional(),
  enrouteBusinessUnits: z.array(z.enum(BUSINESS_UNIT_OPTIONS)).optional(),
  reason: z.string().optional(),
});
```

`plannedDate`/`plannedTime`/`returnTime` stay as plain `z.string().optional()` at the validation layer (matching what `<input type="date">`/`<input type="time">` actually submit — `"2026-07-25"`, `"14:30"`) — the API route is responsible for converting non-empty strings into `Date` objects for Prisma, and passing `undefined` (not an empty string) through to Prisma when a field is omitted, since Prisma rejects `""` for a `DateTime` column.

### 5. API — `app/api/transactions/route.ts` (extend existing `POST`)

The `create()` call's `data` object gains the six new fields, each converted only if present:

```ts
data: {
  transactionCode,
  matrixTypeId: parsed.data.matrixTypeId,
  statusId: openStatus.id,
  creatorId: session.sub,
  plannedDate: parsed.data.plannedDate ? new Date(parsed.data.plannedDate) : undefined,
  plannedTime: parsed.data.plannedTime ? new Date(`1970-01-01T${parsed.data.plannedTime}:00.000Z`) : undefined,
  returnTime: parsed.data.returnTime ? new Date(`1970-01-01T${parsed.data.returnTime}:00.000Z`) : undefined,
  originBusinessUnit: parsed.data.originBusinessUnit,
  enrouteBusinessUnits: parsed.data.enrouteBusinessUnits ?? [],
  reason: parsed.data.reason,
},
```

The `1970-01-01T...Z` construction is the standard way to build a `Date` object for a Postgres `@db.Time`-only column via Prisma — only the time-of-day component is persisted, the date portion is discarded by the database column type.

### 6. UI — `TransactionsView.tsx` (extend the existing modal form)

- Six new form fields added after Transaction Type, in the order listed in §1.
- `Enroute to Other Business Unit` uses a native `<select multiple>` sized to show ~5 options at once (`size={5}`) — deliberately no new multi-select component/library, matching this project's established no-new-dependencies convention.
- All new fields optional: no `required` attribute, and the submit handler sends `undefined`/omits the key for any field left blank (empty string → not sent, so the server-side `.optional()` treats it as absent rather than validating an empty string against `z.enum(...)`).
- Local component state grows from just `matrixTypeId` to one state field per new input (or a single form-state object) — implementation detail for the task brief, not fixed here.

## Testing

- `lib/businessUnitOptions.test.ts` — not planned; it's a static constant, nothing to unit test beyond what the schema/component tests already exercise indirectly.
- `lib/validation/transaction.test.ts` — extend: accepts a body with only `matrixTypeId` (all new fields omitted); accepts a body with all fields populated; rejects an `originBusinessUnit` value outside the fixed list; rejects an `enrouteBusinessUnits` array containing a value outside the fixed list.
- `app/api/transactions/route.test.ts` — extend the existing 201 test to also assert the new fields round-trip correctly (create with all fields populated, re-fetch, compare); add a case confirming a transaction created with all six fields omitted still succeeds (all-optional confirmed end-to-end, not just at the schema layer).
- `TransactionsView.test.tsx` — extend: all six new fields render; submitting with only Transaction Type filled in (everything else left blank) still succeeds and posts a body without the optional keys; selecting multiple options in the Enroute multi-select and submitting includes all selected values in the posted body.

## Explicitly declined / out of scope

- **No link to the existing `BusinessUnit` Prisma model** — explicit user decision, these are plain fixed-list dropdowns.
- **No changes to the Open Transaction list/table view** — the six new fields are captured and stored but not added as new table columns in this round (see Scope note above; flag if this assumption is wrong).
- **No new multi-select UI library** — native `<select multiple>`, matching the project's dependency-avoidance convention.
- **No conditional field visibility** (e.g., showing "Enroute to Other Business Unit" only when Matrix Type is "Routing to other Business Unit") — all six fields always show, uniformly, regardless of the selected Transaction Type.
