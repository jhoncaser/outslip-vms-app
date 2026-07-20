# Settings — Setup Tables (Matrix Type, Department, Business Unit, Location)

**Date:** 2026-07-20
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via visual companion, session `750-1784509596`, screens `edit-button-style.html` reused session → `settings-layout.html`, `settings-layout-v2.html`, `settings-layout-v3.html`)

## Goal

Turn the `/settings` page (currently a `PagePlaceholder`) into the admin hub for four reference-data setups: **Matrix Type**, **Department**, **Business Unit**, **Location**. Admins can view each table and add new rows. This is groundwork for the future Outslip request feature, whose "Matrix Type" dropdown (and Department/Business Unit/Location dropdowns, already used by registration) will read from these same tables.

Editing/deleting rows, and the approval-routing logic that Matrix Type will eventually drive, are explicitly out of scope here (see "Explicitly declined").

## Current state

- `Department`, `BusinessUnit`, `Location` already exist as simple `{id, name}` Prisma models, already used throughout registration/editing. A `POST /api/reference-data` endpoint already supports creating new rows of these three types (gated by `canManageReferenceData` — Admin department), but **nothing calls it yet** — `/settings` is still a placeholder.
- No `MatrixType` model exists yet.
- `canManageReferenceData(user)` (`lib/auth/permissions.ts`) = `user.department === "Admin"`. This is the gate for the whole `/settings` page, matching how `canProvisionUsers` gates `/register`.

## Design

### 1. Data model — `prisma/schema.prisma`

```prisma
model MatrixType {
  id         String   @id @default(cuid())
  matrixCode String   @unique
  name       String   @unique
  createdAt  DateTime @default(now())

  creator   User   @relation(fields: [creatorId], references: [id])
  creatorId String
}
```

Add the back-relation on `User`: `matrixTypesCreated MatrixType[]`.

`name` is unique (not just `matrixCode`) so the seed script stays idempotent on re-run and admins can't create two rows with the same label.

Department/Business Unit/Location are **not** changed — they stay `{id, name}` only, no creator/date tracking (confirmed: "in short... can add new row" — keep those three simple).

### 2. Auto-generated matrix code

Computed server-side at creation time: `` `MT-${String(count + 1).padStart(3, "0")}` `` where `count = await prisma.matrixType.count()`. Not wrapped in a transaction/lock — this is an admin-only, low-frequency action, so a rare race producing a duplicate-attempt is an acceptable, retryable edge case, not a correctness risk worth extra machinery for.

### 3. Seed data — `prisma/seed.ts`

New constant:

```ts
const MATRIX_TYPES = [
  "Halfday",
  "Undertime",
  "Routing to other Business Unit",
  "Visitor Pass",
  "Out for Lunch",
  "Others",
];
```

New `seedMatrixTypes(creatorId: string)` step, run **after** `seedAdmin()` (needs the admin's id as `creatorId`). `seedAdmin()` is adjusted to return the admin user's `id` (whether newly created or pre-existing) so `main()` can pass it through:

```ts
async function seedMatrixTypes(creatorId: string) {
  for (const name of MATRIX_TYPES) {
    const existing = await prisma.matrixType.findUnique({ where: { name } });
    if (existing) continue;
    const count = await prisma.matrixType.count();
    await prisma.matrixType.create({
      data: {
        matrixCode: `MT-${String(count + 1).padStart(3, "0")}`,
        name,
        creatorId,
      },
    });
  }
}
```

### 4. Validation — `lib/validation/matrixType.ts` (new file)

```ts
import { z } from "zod";

export const matrixTypeSchema = z.object({
  name: z.string().min(1),
});
```

### 5. API

**Extend `GET /api/reference-data`** (`app/api/reference-data/route.ts`) to also return `matrixTypes`, so this stays the one endpoint anything (a future Outslip request form, etc.) calls to get all dropdown data in one shot:

```ts
const [departments, businessUnits, locations, matrixTypes] = await Promise.all([
  prisma.department.findMany({ orderBy: { name: "asc" } }),
  prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
  prisma.location.findMany({ orderBy: { name: "asc" } }),
  prisma.matrixType.findMany({ orderBy: { matrixCode: "asc" } }),
]);
return NextResponse.json({ departments, businessUnits, locations, matrixTypes });
```

(Bare rows here — `{id, matrixCode, name, createdAt, creatorId}`, no creator join. The Settings page itself gets creator info from its own server-side fetch, below.)

**New `app/api/matrix-types/route.ts`** — `POST` only (a `GET` here would just duplicate the field just added to `/api/reference-data`, so skip it):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { matrixTypeSchema } from "@/lib/validation/matrixType";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canManageReferenceData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = matrixTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const count = await prisma.matrixType.count();
  const matrixCode = `MT-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.matrixType.create({
    data: { matrixCode, name: parsed.data.name, creatorId: session.sub },
  });

  return NextResponse.json(created, { status: 201 });
}
```

`POST /api/reference-data` is unchanged — Department/Business Unit/Location adds keep using it exactly as it already works.

### 6. Settings page

**`app/(authenticated)/settings/page.tsx`** (server component, replaces the placeholder — same shape as `register/page.tsx`):

- Session check + `canManageReferenceData` gate, `redirect("/dashboard")` if unauthorized.
- Fetch all four datasets directly via Prisma (not through the API routes — same reasoning as `register/page.tsx` fetching users directly):

```ts
const [matrixTypes, departments, businessUnits, locations] = await Promise.all([
  prisma.matrixType.findMany({
    orderBy: { matrixCode: "asc" },
    include: { creator: { select: { email: true } } },
  }),
  prisma.department.findMany({ orderBy: { name: "asc" } }),
  prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
  prisma.location.findMany({ orderBy: { name: "asc" } }),
]);
```

- Format `matrixTypes[].createdAt` server-side, same `en-US` short-month style already used in `register/page.tsx` (hydration-safe).
- Renders `<SettingsView matrixTypes={...} departments={...} businessUnits={...} locations={...} />` inside the same MFC-background wrapper convention as `register/page.tsx`.

**`app/(authenticated)/settings/SettingsView.tsx`** (new client component):

- `activeTab: "matrixType" | "department" | "businessUnit" | "location"` state, default `"matrixType"`.
- `modalOpen: boolean` state.
- **Tile launcher** (final approved mockup): 4 tiles in a row, labels only ("Matrix Type", "Department", "Business Unit", "Location"), same left-accent-border card style as the dashboard's `ModuleGrid` tiles. Clicking a tile sets `activeTab`. The active tile gets a persistent version of `ModuleGrid`'s hover treatment — thicker left border (4px → 6px), faint green background wash, green text — applied via the active state rather than `:hover`.
- Below the tiles: an "+ Add {label}" button (label matches the active tab) that opens the modal, then the active tab's table:
  - **Matrix Type:** 4 columns — Matrix Code, Matrix Type, Creator, Date Created. Same table chrome as `UsersView` (green `#2C7001` bold-white header, zebra rows).
  - **Department / Business Unit / Location:** a shared small table (single "Name" column), same chrome, reused across the three tabs by passing in `{label, rows}`.
- **Modal:** same chrome as `UsersView`'s (green gradient header, ✕-only close, centered overlay, backdrop/Escape do not dismiss), containing a single "Name" text input + submit. Header text reads "ADD {LABEL}" (e.g. "ADD MATRIX TYPE", "ADD DEPARTMENT").
- **Submit:** Matrix Type → `POST /api/matrix-types` with `{ name }`. Department/Business Unit/Location → `POST /api/reference-data` with `{ type, name }` (type mapped from `activeTab`). On success: close modal, `router.refresh()` (same convention as `UsersView`/`RegistrationWizard` — reloads the server component's data).

## Accessibility

- Tiles are buttons (not links, since they switch local view state rather than navigate), with `aria-pressed` reflecting whether each is the active tab.
- Modal behavior (focus, close button, dialog role) mirrors `UsersView`'s existing modal exactly — no new pattern introduced.

## Testing

- `lib/validation/matrixType.test.ts` — accepts a valid `{name}`, rejects an empty name.
- `app/api/matrix-types/route.test.ts` — 401 no session; 403 non-admin session; 400 empty name; 201 creates with the expected sequential code (`MT-001` then `MT-002` on a second call against a seeded-empty test DB); creator set from the session's `sub`.
- `app/api/reference-data/route.test.ts` — extend the existing GET test to assert the response includes a `matrixTypes` array.
- `SettingsView.test.tsx` (new) — default tab is Matrix Type; clicking a tile switches the active table and updates the "+ Add" button's label; each tab's Add flow calls the correct endpoint with the correct body (`POST /api/matrix-types` for Matrix Type, `POST /api/reference-data` with the right `type` for the other three); successful submit closes the modal.
- No `settings/page.tsx`-level test — matches `register/page.tsx`, which also has none (gating logic is exercised indirectly via `permissions.test.ts`).

## Explicitly declined / out of scope

- **Editing or deleting** any of the four setups — only "add new row" was requested.
- **Approval-level/routing configuration on `MatrixType`** — the user will provide this separately; the table stays code+label+creator+date for now.
- **Creator/date tracking on Department/Business Unit/Location** — staying simple, name-only, per the "in short" scoping message.
- **Migrating the legacy screenshot's real rows** — explicitly just a shape reference; only the 6 fresh seed values are used.
