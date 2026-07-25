# Matrix Type Approver Setup — Design

**Date:** 2026-07-25
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming` with the visual companion, session `1419-1784950419`)

## Goal

Let admins configure, per Matrix Type, who approves requests at each level (1-3), scoped to a specific Department + Business Unit + Location. This is the configuration/setup piece only — wiring it into the actual Open Transaction approval workflow (statuses, approve/reject actions, "My Approvals" tile) is explicitly deferred to a future round, per the user: "just build the config table + Settings screen now."

## Scope

- **Add-only.** No edit/delete yet — explicitly deferred by the user ("we will work on the edit/delete assignment later. i will let you know").
- **No wiring into the transaction creation/approval flow.** A newly filed transaction does not look up or store an approval chain from this table yet. Purely configuration for now.
- **Admin-only**, gated by the existing `canManageReferenceData` check (Admin department), same as Matrix Type/Department/Business Unit/Location today.

## Design

### 1. Data model

New Prisma model `MatrixTypeApprover`:

```prisma
model MatrixTypeApprover {
  id        String   @id @default(cuid())
  level     Int
  createdAt DateTime @default(now())

  matrixType   MatrixType @relation(fields: [matrixTypeId], references: [id])
  matrixTypeId String

  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String

  businessUnit   BusinessUnit @relation(fields: [businessUnitId], references: [id])
  businessUnitId String

  location   Location @relation(fields: [locationId], references: [id])
  locationId String

  approver   User   @relation(fields: [approverId], references: [id])
  approverId String

  @@unique([matrixTypeId, level, departmentId, businessUnitId, locationId])
  @@unique([matrixTypeId, approverId, departmentId, businessUnitId, locationId])
}
```

- First unique constraint: **one approver per slot** — can't double-assign the same Matrix Type + Level + Department + Business Unit + Location combination.
- Second unique constraint: **no approver holding two levels in the same combo** — an approver can't be both the Level 1 and Level 2 (etc.) approver for the same Matrix Type + Department + Business Unit + Location, but can hold a level in a *different* combination elsewhere.
- `User`, `MatrixType`, `Department`, `BusinessUnit`, `Location` each gain a new back-relation (`approverAssignments MatrixTypeApprover[]` on `User`; equivalent on the other four).
- No creator/audit tracking on this table — not requested, kept simple (unlike `MatrixType`, which tracks a creator).
- `level` is a plain `Int` (1-3), constrained by Zod validation at the API layer, not a Postgres enum or a foreign key to the `Role` enum — the assigned approver's `Role` on their `User` record is completely independent of the `level` value here, confirmed explicitly by the user (no role-based filtering on the Approver dropdown).
- Migration applied to the live Neon DB via `npx prisma migrate dev`, same process as every other schema change on this branch.

### 2. Navigation & UI

No new route or URL. Within the existing Settings → Matrix Type tab, each row in `MatrixTypeTable` (`app/(authenticated)/settings/SettingsView.tsx`) becomes clickable (cursor pointer, hover tint), swapping the tab's rendered content from the list into a **detail view** for that matrix type via local component state — the same kind of discriminated-union view state already used for the Edit User flow in `UsersView.tsx`. No new Prisma-fetching route is introduced for this navigation.

**Detail view:**

```
┌──────────────────────────────────────────────┐
│ ← Settings / Matrix Type                      │
│ ┌────────────────────────────────────────────┐│
│ │ (green gradient banner)      [+ Add Approver]│
│ │  VISITOR PASS                                ││
│ │  MT-004 · Approver setup                     ││
│ └────────────────────────────────────────────┘│
│  [Business Unit: All ▾]  [Location: All ▾]     │
│ ┌────────────────────────────────────────────┐│
│ │ Approver | Level | Department | BU | Location││
│ │ ...                                          ││
│ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- Green gradient banner (`from-[#2C7001] to-[#1d4d00]`, same convention as every other banner/modal header in the app): matrix type name (uppercase), matrix code + "Approver setup" subtitle, "+ Add Approver" button in the corner.
- Breadcrumb above the banner: "← Settings / Matrix Type" link, returns to the list view.
- Two filter dropdowns above the table: **Business Unit** (default "All") and **Location** (default "All") — purely client-side filters over already-fetched data, no new fetch triggered by changing them. (This was chosen over a Location→Business Unit sidebar-tree alternative shown in the mockup — see Out of scope.)
- Table columns: Approver, Level, Department, Business Unit, Location — rows scoped to the selected matrix type, further narrowed by the two filter dropdowns.

### 3. "+ Add Approver" modal

Opened from the detail view's "+ Add Approver" button. Matches this app's existing modal chrome exactly: green gradient header with decorative circles, X close button, single full-width "Save" button at the bottom (not a top Cancel/Save button bar). **Matrix Type is not a field** — it's implied by the detail view's context and included as a fixed value in the submitted request body.

Five required dropdown fields, all mandatory:

- **Approver** — every user (`id`, `"${firstName} ${lastName}"`), unrestricted by role.
- **Level** — 1, 2, or 3.
- **Department**, **Business Unit**, **Location** — existing reference-data lists (same source as every other Department/Business Unit/Location dropdown in the app).

On submit: `POST /api/matrix-type-approvers` with `{ matrixTypeId, approverId, level, departmentId, businessUnitId, locationId }`.

### 4. Data flow

`app/(authenticated)/settings/page.tsx` (server component) gains two more Prisma queries alongside the existing four (`matrixTypes`/`departments`/`businessUnits`/`locations`):

- All `MatrixTypeApprover` rows with relations resolved to display values (approver's full name, department/business unit/location names, matrix type name + code) — passed to `SettingsView` as a new prop.
- All `User` rows (`id`, `firstName`, `lastName` only), ordered `[{ firstName: "asc" }, { lastName: "asc" }]` (same ordering convention used elsewhere in this app), for the Approver dropdown — passed as a new prop.

This mirrors the page's existing pattern exactly: `page.tsx` performs all reads via Prisma up front; only the POST (create) goes through a client-side `fetch`.

### 5. API: `POST /api/matrix-type-approvers`

New route, following the same shape as `/api/matrix-types` and `/api/transactions`:

- `401` if not authenticated.
- `403` if `!canManageReferenceData(session)` (Admin department only).
- `400` on Zod validation failure (new `lib/validation/matrixTypeApprover.ts` schema — all five fields required, `level` constrained to `1 | 2 | 3`).
- `400` on Prisma `P2003` (bad FK — e.g. a stale `matrixTypeId`/`departmentId`/etc.), matching the Transaction route's convention.
- `409` on `P2002`, discriminated by `err.meta.target` into two distinct messages:
  - Slot constraint hit → `"An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination."`
  - Approver-per-combo constraint hit → `"This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination."`
- `201` with the created row on success.

### 6. Testing

- `app/api/matrix-type-approvers/route.test.ts`: 401 / 403 / 400 (validation) / 400 (bad FK) / 409 (both constraints, forced the same way the Matrix Type and Transaction routes already force their own constraint violations in tests) / 201 — against the real test DB.
- `SettingsView.test.tsx` (extended): clicking a Matrix Type row shows its detail view; breadcrumb navigates back to the list; the two filter dropdowns narrow the visible rows; "+ Add Approver" opens the modal with exactly the five fields; Matrix Type is confirmed absent as a field.

## Out of scope

- Editing or deleting an existing approver assignment — deferred, user will ask for it later.
- Wiring this table into the actual transaction creation/approval flow (a newly filed transaction does not yet compute or store its approval chain) — a separate future round.
- Restricting the Approver dropdown by the assigned user's `Role` — explicitly declined by the user.
- Location/Business-Unit sidebar-tree filtering with counts — shown as Option B in the mockup; user chose Option A (simple dropdown filters) instead.
- A Status/Active toggle on assignments — raised via a reference screenshot, not adopted for this round (rows are add-only, no soft-disable).
- Grouping the approver list by Department — raised via a reference screenshot, not adopted; flat table per matrix type, filterable by the two dropdowns instead.
