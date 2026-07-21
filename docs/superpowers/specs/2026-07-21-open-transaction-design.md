# Open Transaction — Filing & List View

**Date:** 2026-07-21
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via visual companion, session `832-1784604662`, screens `open-transaction-layout.html`, `open-transaction-layout-v2.html`)

## Goal

Turn the `/transactions/open` page (currently a `PagePlaceholder`) into a real page: a table of open outslip/transaction requests, with a "+ Add Transaction" button that opens a modal to file a new one. This is the first building block of the future Outslip request feature — same decomposition as Matrix Type was for Settings (see `2026-07-20-settings-setup-tables-design.md`).

**This round captures exactly one field: Transaction Type** (a dropdown sourced from the `MatrixType` list already built). All other fields a real outslip request will eventually need (date/time, destination, remarks, etc.) are explicitly deferred — the user will specify them in a later round. Approval-level/routing logic (who approves at which stage, driven by Matrix Type × Department/Business Unit/Location) is also explicitly deferred; the user will provide that separately.

## Current state

- No `Transaction` model exists in `prisma/schema.prisma` — this is a greenfield subsystem, unlike Settings which had existing-but-unused reference tables to build on.
- `app/(authenticated)/transactions/open/page.tsx` is a bare `PagePlaceholder`. The dashboard tile linking to it (`components/dashboard/ModuleGrid.tsx`) is visible to every authenticated user, not role-gated.
- `MatrixType` (id, matrixCode, name, createdAt, creatorId) already exists and is seeded (Halfday, Undertime, Routing to other Business Unit, Visitor Pass, Out for Lunch, Others) — this is the data source for the Transaction Type dropdown.
- No concept of transaction/request status exists anywhere in the schema yet.

## Design

### 1. Data model — `prisma/schema.prisma`

Two new models. `TransactionStatus` is a **data table, not an enum** — the user explicitly wants status to be admin/data-driven rather than hardcoded, because future stages (Posted, 1st/2nd/3rd Level Approver, etc.) will vary per Matrix Type once approval-routing is built, and a fixed enum can't represent that.

```prisma
model TransactionStatus {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())

  transactions Transaction[]
}

model Transaction {
  id              String   @id @default(cuid())
  transactionCode String   @unique
  createdAt       DateTime @default(now())

  matrixType   MatrixType @relation(fields: [matrixTypeId], references: [id])
  matrixTypeId String

  status   TransactionStatus @relation(fields: [statusId], references: [id])
  statusId String

  creator   User   @relation(fields: [creatorId], references: [id])
  creatorId String
}
```

`TransactionStatus.transactions` (shown above) is one of three back-relations needed — also add `User.transactionsCreated Transaction[]` and `MatrixType.transactions Transaction[]`.

### 2. Auto-generated transaction code

Same idea as Matrix Type's `MT-XXX`, prefixed `OT-` (Outslip Transaction): `` `OT-${String(count + 1).padStart(3, "0")}` ``.

**Unlike Matrix Type, this must be built with retry-on-collision from the start**, not the naive `count()`-then-`create()` that Matrix Type shipped with and had to be fixed after the fact (see `.superpowers/sdd/progress.md`, Task 2 fix). Reasoning: Matrix Type creation is an admin-only, low-frequency action; transaction filing is open to *every* authenticated user and will plausibly see near-simultaneous submissions (e.g., several employees filing around the same lunch break). Reuse the exact pattern already proven at `app/api/matrix-types/route.ts`: a bounded retry loop that recomputes `count()` on each attempt and inspects `err.meta.target` to distinguish a `transactionCode` collision (retry) from any other unique violation.

### 3. Seed data — `prisma/seed.ts`

Seed **only one** `TransactionStatus` row: `"Open"`. This is a deliberate minimal choice, not an oversight — the user described the fuller stage list (Posted, 1st/2nd/3rd Level Approver, etc.) conversationally but as illustrative of the *future* workflow, not as finalized names to commit to now. Since `TransactionStatus` is a data table, adding those rows later is a seed/data change, not a migration — no cost to deferring it until the Post/Approve workflow that actually uses them is designed.

```ts
const TRANSACTION_STATUSES = ["Open"];
```

New `seedTransactionStatuses()` step in `main()`, same idempotent shape as `seedMatrixTypes` (skip if a row with that name already exists).

### 4. Validation — `lib/validation/transaction.ts` (new file)

```ts
import { z } from "zod";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
});
```

### 5. API — `app/api/transactions/route.ts` (new, `POST` only)

- 401 if no session (any authenticated user may file — no permission gate beyond being logged in, per the user: "the add button should be accessible to all").
- 400 on `transactionSchema` validation failure.
- Look up the `"Open"` `TransactionStatus` row (`findUniqueOrThrow`).
- Retry loop generating `transactionCode`, same shape as `app/api/matrix-types/route.ts`'s fixed version:
  - `matrixCode`-equivalent (`transactionCode`) collision on `P2002` → retry with recomputed count.
  - Any other `P2002` (shouldn't occur here, no other unique field) → rethrow.
- **New failure mode this route has that matrix-types doesn't:** `matrixTypeId` references a real but foreign-key-checked row. If the client sends a stale/invalid id, `create()` throws `P2003` (foreign key constraint violation) — catch it and return `400 { error: "Invalid transaction type" }` rather than letting it surface as a 500.
- On success: `201` with the created `Transaction` row.

### 6. Open Transaction page

**`app/(authenticated)/transactions/open/page.tsx`** (server component, replaces the placeholder):

- Session check only (`redirect("/login")` pattern already used elsewhere if no session) — no `canManageReferenceData`-style gate, since this page is open to everyone.
- Fetch, directly via Prisma (same reasoning as `settings/page.tsx` and `register/page.tsx`):

```ts
const [transactions, matrixTypes] = await Promise.all([
  prisma.transaction.findMany({
    where: { status: { name: "Open" } },
    orderBy: { createdAt: "desc" },
    include: {
      matrixType: { select: { name: true } },
      status: { select: { name: true } },
      creator: { select: { firstName: true, lastName: true } },
    },
  }),
  prisma.matrixType.findMany({ orderBy: { name: "asc" } }),
]);
```

- Map to display rows server-side: `createdBy` = `` `${creator.firstName} ${creator.lastName}` `` (a friendlier, list-facing choice than Matrix Type's email-only `creator` column in Settings — this page is seen by every user, not just admins). `createdAt` formatted with the same `en-US` short-month convention used elsewhere (hydration-safe).
- Renders `<TransactionsView transactions={...} matrixTypes={...} />` inside the same MFC-background wrapper convention as the other authenticated pages.

**`app/(authenticated)/transactions/open/TransactionsView.tsx`** (new client component):

- Props: `{ transactions: TransactionRow[]; matrixTypes: { id: string; name: string }[] }` where `TransactionRow = { id: string; transactionCode: string; matrixTypeName: string; createdBy: string; statusName: string; createdAt: string }`.
- Table columns, per the approved mockup: **Code, Transaction Type, Created By, Status, Date Filed** — green `#2C7001` bold-white header, zebra rows, same chrome as `MatrixTypeTable`. Status rendered as a pill; only `"Open"` exists today, styled as a neutral grey pill (`bg-slate-100 text-slate-600`) — reserved room for a distinct color once "Posted" and later stages exist, but no color-mapping logic is built now (would be premature for a one-value set).
- "+ Add Transaction" button, upper right, same green pill convention as Settings' "+ Add {label}" button.
- **Modal:** same chrome as Settings' add-modal (green gradient header "ADD TRANSACTION", ✕-only close, centered overlay, backdrop/Escape do not dismiss — consistent with the rest of the app). Single field: **Transaction Type**, a `<select>` (not a text input, since the values are a fixed set) populated from the `matrixTypes` prop, required.
- **Submit:** `POST /api/transactions` with `{ matrixTypeId }`. On success: close modal, `router.refresh()` (same convention as `SettingsView`/`UsersView`). On failure: show the server's error message via the same `role="alert"` pattern already used elsewhere.

## Accessibility

Identical conventions to the Settings modal — dialog role, `aria-labelledby`, no focus trap (matches the accepted gap already present in `SettingsView`'s modal; not introducing a new pattern).

## Testing

- `lib/validation/transaction.test.ts` — accepts a valid `{matrixTypeId}`, rejects an empty/missing one.
- `app/api/transactions/route.test.ts` — 401 no session; 400 missing/empty `matrixTypeId`; 400 for a well-formed but non-existent `matrixTypeId` (FK violation path); 201 creates with the expected sequential `OT-XXX` code, `"Open"` status, and creator from the session; a retry-on-collision regression test mirroring `matrix-types/route.test.ts`'s (`vi.spyOn(prisma.transaction.count).mockResolvedValueOnce(...)` to force the same TOCTOU race deterministically).
- `TransactionsView.test.tsx` — renders table rows from props; "+ Add Transaction" opens the modal; the dropdown lists the passed-in matrix types; submit posts `{matrixTypeId}` to `/api/transactions`; successful submit closes the modal.
- No `page.tsx`-level test, matching `settings/page.tsx` and `register/page.tsx` precedent (no test for either).

## Explicitly declined / out of scope

- **Any field beyond Transaction Type** (date/time, destination, remarks, etc.) — user will specify these in a later round.
- **Approval-level/routing logic and the Post/Approve action buttons** that will eventually move a transaction through `TransactionStatus` stages — explicitly deferred, user will provide separately.
- **Seeding the full status list** (Posted, 1st/2nd/3rd Level Approver, Approved, Canceled) — only `"Open"` is seeded now; the rest arrive with the workflow feature that actually uses them.
- **A Settings tile to manage `TransactionStatus`** — not built yet; the list is fixed seed data for now.
- **The Approved / Canceled / My Approvals pages** — untouched, remain placeholders.
- **Editing or canceling a filed transaction** — only "add new" was requested.
