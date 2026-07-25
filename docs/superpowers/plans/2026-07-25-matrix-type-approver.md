# Matrix Type Approver Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins configure, per Matrix Type, who approves requests at each level (1-3), scoped to a Department + Business Unit + Location — a new database table plus a Settings screen to manage it.

**Architecture:** A new `MatrixTypeApprover` Prisma model with two compound unique constraints enforces the assignment rules at the database layer. A new `POST /api/matrix-type-approvers` route creates rows (Admin-only). In the existing Settings → Matrix Type tab, clicking a row swaps the view (via local component state, no new route) into a detail screen — a new `MatrixTypeApproverDetail` component — showing that matrix type's assigned approvers with Business Unit/Location filters and an "Add Approver" modal.

**Tech Stack:** Next.js 16 App Router (server components + client components), Prisma, Zod, Tailwind CSS v4, Vitest + Testing Library.

## Global Constraints

- **Add-only.** No edit/delete UI or API in this plan — deferred by the user to a later round.
- **No wiring into the transaction creation/approval flow.** A filed transaction does not read or store anything from this table in this plan.
- **Admin-only**, gated by the existing `canManageReferenceData` check (Admin department) — same gate as Matrix Type/Department/Business Unit/Location today.
- **Two unique constraints, exact column sets:**
  - `@@unique([matrixTypeId, level, departmentId, businessUnitId, locationId])` — one approver per slot.
  - `@@unique([matrixTypeId, approverId, departmentId, businessUnitId, locationId])` — an approver can't hold two different levels for the same Matrix Type + Department + Business Unit + Location combination.
- **No creator/audit tracking** on `MatrixTypeApprover` (unlike `MatrixType`) — not requested, keep it simple.
- **`level` is a plain `Int` (1-3)**, validated by Zod, completely independent of the assigned user's `Role` enum — the Approver dropdown is never filtered by role.
- **No new route or URL.** Navigating into a Matrix Type's approver setup is a client-side view swap within `SettingsView.tsx`, not a new page.
- **Matrix Type is not a field in the "Add Approver" modal** — it's implied by which matrix type's detail view the modal was opened from, and included as a fixed value in the request body.
- **Filtering is two plain dropdowns** (Business Unit, Location, both default "All") — not a sidebar tree, not grouping by Department, not a Status/Active column. These alternatives were shown to the user and explicitly not chosen.
- **Modal chrome matches this app's existing convention exactly**: green gradient header with decorative circles, a lone X close button, a single full-width "Save" button at the bottom — not a top Cancel/Save button bar.
- **Exact 409 error message text:**
  - Slot constraint: `"An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination."`
  - Approver-per-combo constraint: `"This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination."`
- **Approver dropdown ordering:** all users, ordered `[{ firstName: "asc" }, { lastName: "asc" }]`.

---

### Task 1: `MatrixTypeApprover` schema, migration, and validation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/validation/matrixTypeApprover.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (consumed by Task 2): Prisma model `MatrixTypeApprover` with fields `id, level, matrixTypeId, departmentId, businessUnitId, locationId, approverId, createdAt`; exported `matrixTypeApproverSchema` (Zod) from `lib/validation/matrixTypeApprover.ts` validating `{ matrixTypeId: string, approverId: string, level: 1|2|3, departmentId: string, businessUnitId: string, locationId: string }`.

- [ ] **Step 1: Add the `MatrixTypeApprover` model and back-relations to the schema**

In `prisma/schema.prisma`, add a `matrixTypeApprovers MatrixTypeApprover[]` back-relation field to `Department`, `BusinessUnit`, and `Location`, an `approverAssignments MatrixTypeApprover[]` back-relation to `User`, an `approvers MatrixTypeApprover[]` back-relation to `MatrixType`, and the new model itself:

```prisma
model Department {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
  matrixTypeApprovers MatrixTypeApprover[]
}

model BusinessUnit {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
  matrixTypeApprovers MatrixTypeApprover[]
}

model Location {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
  matrixTypeApprovers MatrixTypeApprover[]
}

model User {
  id                 String   @id @default(cuid())
  firstName          String
  middleName         String?
  lastName           String
  jobTitle           String
  email              String   @unique
  passwordHash       String
  role               Role
  mustChangePassword Boolean  @default(true)
  createdAt          DateTime @default(now())

  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String

  businessUnit   BusinessUnit @relation(fields: [businessUnitId], references: [id])
  businessUnitId String

  location   Location @relation(fields: [locationId], references: [id])
  locationId String

  matrixTypesCreated  MatrixType[]
  transactionsCreated Transaction[]
  approverAssignments MatrixTypeApprover[]
}

model MatrixType {
  id         String   @id @default(cuid())
  matrixCode String   @unique
  name       String   @unique
  createdAt  DateTime @default(now())

  creator      User          @relation(fields: [creatorId], references: [id])
  creatorId    String
  transactions Transaction[]
  approvers    MatrixTypeApprover[]
}

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

Leave every other existing model (`TransactionStatus`, `Transaction`, `Role` enum) untouched — only `Department`, `BusinessUnit`, `Location`, `User`, and `MatrixType` gain the new back-relation field shown above, plus the new `MatrixTypeApprover` model.

- [ ] **Step 2: Format and generate**

Run: `npx prisma format`
Run: `npx prisma generate`
Expected: both complete with no errors; `@prisma/client` now exposes `prisma.matrixTypeApprover`.

- [ ] **Step 3: Apply the migration to the live Neon DB**

Run: `npx prisma migrate dev --name add_matrix_type_approver`
Expected: a new migration folder under `prisma/migrations/`, output ending in `Your database is now in sync with your schema.`

- [ ] **Step 4: Write the validation schema**

Create `lib/validation/matrixTypeApprover.ts`:

```ts
import { z } from "zod";

export const matrixTypeApproverSchema = z.object({
  matrixTypeId: z.string().min(1),
  approverId: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  departmentId: z.string().min(1),
  businessUnitId: z.string().min(1),
  locationId: z.string().min(1),
});
```

- [ ] **Step 5: Verify the schema compiles and the client is usable**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/validation/matrixTypeApprover.ts
git commit -m "Add MatrixTypeApprover model, migration, and validation schema"
```

---

### Task 2: `POST /api/matrix-type-approvers`

**Files:**
- Create: `app/api/matrix-type-approvers/route.ts`
- Test: `app/api/matrix-type-approvers/route.test.ts`

**Interfaces:**
- Consumes: `matrixTypeApproverSchema` from `lib/validation/matrixTypeApprover.ts` (Task 1); `prisma.matrixTypeApprover` (Task 1); `canManageReferenceData` from `lib/auth/permissions.ts` (existing); `verifySessionToken`/`SESSION_COOKIE_NAME`/`createSessionToken` from `lib/auth/session.ts` (existing).
- Produces (consumed by Task 3): `POST /api/matrix-type-approvers` accepting `{ matrixTypeId, approverId, level, departmentId, businessUnitId, locationId }`, returning `201` with the created row, `401`/`403`/`400`, or `409` with one of the two exact messages from Global Constraints.

- [ ] **Step 1: Write the failing tests**

Create `app/api/matrix-type-approvers/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let adminToken: string;
let nonAdminToken: string;
let matrixTypeId: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
let approverAId: string;
let approverBId: string;

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/matrix-type-approvers", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/matrix-type-approvers", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    businessUnitId = businessUnit.id;

    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });
    locationId = location.id;

    const adminUser = await prisma.user.upsert({
      where: { email: "matrix-type-approvers-route-test-admin@example.com" },
      update: {},
      create: {
        firstName: "MTA",
        lastName: "Admin",
        jobTitle: "Tester",
        email: "matrix-type-approvers-route-test-admin@example.com",
        passwordHash: "unused",
        role: "FIRST_APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });

    adminToken = await createSessionToken({
      sub: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonAdminToken = await createSessionToken({
      sub: "regular_user",
      email: "regular@company.com",
      firstName: "Regular",
      lastName: "User",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    const approverA = await prisma.user.upsert({
      where: { email: "mta-route-test-approver-a@example.com" },
      update: {},
      create: {
        firstName: "ApproverA",
        lastName: "MtaTest",
        jobTitle: "Tester",
        email: "mta-route-test-approver-a@example.com",
        passwordHash: "unused",
        role: "FIRST_APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverAId = approverA.id;

    const approverB = await prisma.user.upsert({
      where: { email: "mta-route-test-approver-b@example.com" },
      update: {},
      create: {
        firstName: "ApproverB",
        lastName: "MtaTest",
        jobTitle: "Tester",
        email: "mta-route-test-approver-b@example.com",
        passwordHash: "unused",
        role: "SECOND_APPROVER",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    approverBId = approverB.id;

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "MTA Route Test Type" },
      update: {},
      create: {
        matrixCode: "MT-MTA-TEST",
        name: "MTA Route Test Type",
        creatorId: adminUser.id,
      },
    });
    matrixTypeId = matrixType.id;

    await prisma.matrixTypeApprover.deleteMany({ where: { matrixTypeId } });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, {}));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-Admin-department user", async () => {
    const response = await POST(requestWithCookie(nonAdminToken, {}));
    expect(response.status).toBe(403);
  });

  it("returns 400 when a required field is missing", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 1,
        departmentId,
        businessUnitId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid level", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 4,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a bad foreign key (unknown approverId)", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: "does-not-exist",
        level: 3,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates an approver assignment", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.matrixTypeId).toBe(matrixTypeId);
    expect(body.approverId).toBe(approverAId);
    expect(body.level).toBe(1);
  });

  it("returns 409 when the same slot is already taken by a different approver", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverBId,
        level: 1,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination."
    );
  });

  it("returns 409 when the same approver already holds a different level for this combination", async () => {
    const response = await POST(
      requestWithCookie(adminToken, {
        matrixTypeId,
        approverId: approverAId,
        level: 2,
        departmentId,
        businessUnitId,
        locationId,
      })
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination."
    );
  });

  afterAll(async () => {
    await prisma.matrixTypeApprover.deleteMany({ where: { matrixTypeId } });
    await prisma.$disconnect();
  });
});
```

Note the fixture email/name prefixes (`matrix-type-approvers-route-test-*`, `mta-route-test-*`) and the dedicated `"MTA Route Test Type"` matrix type — deliberately distinct from the `"Route-Test"` prefix used by `matrix-types/route.test.ts`, which is documented to collide with other files' fixtures if reused (see the branch handoff's known gotchas). Cleanup here is scoped by `matrixTypeId` (a dedicated fixture row), not a string-prefix match, so it cannot collide with any other test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/matrix-type-approvers/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (the route doesn't exist yet).

- [ ] **Step 3: Write the route**

Create `app/api/matrix-type-approvers/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { matrixTypeApproverSchema } from "@/lib/validation/matrixTypeApprover";

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
  const parsed = matrixTypeApproverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const created = await prisma.matrixTypeApprover.create({
      data: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target : [];
      if (fields.includes("approverId")) {
        return NextResponse.json(
          {
            error:
              "This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination.",
          },
          { status: 409 }
        );
      }
      if (fields.includes("level")) {
        return NextResponse.json(
          {
            error:
              "An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination.",
          },
          { status: 409 }
        );
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/matrix-type-approvers/route.test.ts`
Expected: PASS — 8/8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/matrix-type-approvers/route.ts app/api/matrix-type-approvers/route.test.ts
git commit -m "Add POST /api/matrix-type-approvers"
```

---

### Task 3: `MatrixTypeApproverDetail` component

**Files:**
- Create: `app/(authenticated)/settings/MatrixTypeApproverDetail.tsx`
- Test: `app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (calls `fetch("/api/matrix-type-approvers", ...)` directly, matching Task 2's contract; standalone otherwise).
- Produces (consumed by Task 4):
  ```ts
  export type ApproverAssignmentRow = {
    id: string;
    matrixTypeId: string;
    approverName: string;
    level: number;
    department: string;
    businessUnit: string;
    location: string;
  };
  export type UserOption = { id: string; name: string };
  export function MatrixTypeApproverDetail(props: {
    matrixType: { id: string; matrixCode: string; name: string };
    assignments: ApproverAssignmentRow[];
    users: UserOption[];
    departments: { id: string; name: string }[];
    businessUnits: { id: string; name: string }[];
    locations: { id: string; name: string }[];
    onBack: () => void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

Create `app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MatrixTypeApproverDetail,
  type ApproverAssignmentRow,
  type UserOption,
} from "./MatrixTypeApproverDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const matrixType = { id: "mt1", matrixCode: "MT-004", name: "Visitor Pass" };
const assignments: ApproverAssignmentRow[] = [
  {
    id: "a1",
    matrixTypeId: "mt1",
    approverName: "Jhon Caser",
    level: 1,
    department: "ICT",
    businessUnit: "Cawit",
    location: "Zamboanga",
  },
  {
    id: "a2",
    matrixTypeId: "mt1",
    approverName: "Analyn Gentizon",
    level: 2,
    department: "HR",
    businessUnit: "Ayala",
    location: "Manila",
  },
];
const users: UserOption[] = [
  { id: "u1", name: "Jhon Caser" },
  { id: "u2", name: "Analyn Gentizon" },
];
const departments = [{ id: "d1", name: "ICT" }];
const businessUnits = [{ id: "b1", name: "Cawit" }, { id: "b2", name: "Ayala" }];
const locations = [{ id: "l1", name: "Zamboanga" }, { id: "l2", name: "Manila" }];

function renderDetail(onBack = vi.fn()) {
  return render(
    <MatrixTypeApproverDetail
      matrixType={matrixType}
      assignments={assignments}
      users={users}
      departments={departments}
      businessUnits={businessUnits}
      locations={locations}
      onBack={onBack}
    />
  );
}

describe("MatrixTypeApproverDetail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: async () => ({ id: "new1" }) })
      )
    );
  });

  it("renders the banner with the matrix type name and code", () => {
    renderDetail();
    expect(screen.getByText("VISITOR PASS")).toBeInTheDocument();
    expect(screen.getByText(/MT-004/)).toBeInTheDocument();
  });

  it("renders the assignments table", () => {
    renderDetail();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Approver" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Level" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no assignments", () => {
    render(
      <MatrixTypeApproverDetail
        matrixType={matrixType}
        assignments={[]}
        users={users}
        departments={departments}
        businessUnits={businessUnits}
        locations={locations}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/no approvers assigned yet/i)).toBeInTheDocument();
  });

  it("filters the table by Business Unit", () => {
    renderDetail();
    fireEvent.change(screen.getByLabelText(/filter by business unit/i), {
      target: { value: "Ayala" },
    });
    expect(screen.queryByText("Jhon Caser")).not.toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
  });

  it("filters the table by Location", () => {
    renderDetail();
    fireEvent.change(screen.getByLabelText(/filter by location/i), {
      target: { value: "Manila" },
    });
    expect(screen.queryByText("Jhon Caser")).not.toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
  });

  it("calls onBack when the breadcrumb is clicked", () => {
    const onBack = vi.fn();
    renderDetail(onBack);
    fireEvent.click(screen.getByRole("button", { name: /settings \/ matrix type/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("opens the Add Approver modal with exactly five fields and no Matrix Type field", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/^approver$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^level$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^business unit$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/matrix type/i)).not.toBeInTheDocument();
  });

  it("submits the new assignment to /api/matrix-type-approvers with matrixTypeId included", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));

    fireEvent.change(screen.getByLabelText(/^approver$/i), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText(/^level$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^department$/i), { target: { value: "d1" } });
    fireEvent.change(screen.getByLabelText(/^business unit$/i), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/matrix-type-approvers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt1",
            approverId: "u1",
            level: 1,
            departmentId: "d1",
            businessUnitId: "b1",
            locationId: "l1",
          }),
        })
      )
    );
  });

  it("closes the modal after a successful submit", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));
    fireEvent.change(screen.getByLabelText(/^approver$/i), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText(/^level$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^department$/i), { target: { value: "d1" } });
    fireEvent.change(screen.getByLabelText(/^business unit$/i), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx"`
Expected: FAIL — module `./MatrixTypeApproverDetail` not found.

- [ ] **Step 3: Write the component**

Create `app/(authenticated)/settings/MatrixTypeApproverDetail.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type ApproverAssignmentRow = {
  id: string;
  matrixTypeId: string;
  approverName: string;
  level: number;
  department: string;
  businessUnit: string;
  location: string;
};
export type UserOption = { id: string; name: string };
type OptionRow = { id: string; name: string };

function CloseIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const labelClassName = "mb-1 block text-xs font-semibold text-slate-600";
const inputClassName =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";
const filterClassName =
  "rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";

export function MatrixTypeApproverDetail({
  matrixType,
  assignments,
  users,
  departments,
  businessUnits,
  locations,
  onBack,
}: {
  matrixType: { id: string; matrixCode: string; name: string };
  assignments: ApproverAssignmentRow[];
  users: UserOption[];
  departments: OptionRow[];
  businessUnits: OptionRow[];
  locations: OptionRow[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [level, setLevel] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filtered = assignments.filter((row) => {
    if (businessUnitFilter && row.businessUnit !== businessUnitFilter) return false;
    if (locationFilter && row.location !== locationFilter) return false;
    return true;
  });

  function openModal() {
    setApproverId("");
    setLevel("");
    setDepartmentId("");
    setBusinessUnitId("");
    setLocationId("");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/matrix-type-approvers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matrixTypeId: matrixType.id,
        approverId,
        level: Number(level),
        departmentId,
        businessUnitId,
        locationId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setModalOpen(false);
    router.refresh();
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-xs font-semibold text-[#2C7001] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40 rounded"
      >
        ← Settings / Matrix Type
      </button>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-8 py-6">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
        />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-widest text-white">
              {matrixType.name.toUpperCase()}
            </h2>
            <p className="mt-1 text-xs text-white/80">
              {matrixType.matrixCode} · Approver setup
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="rounded-full bg-white/15 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            + Add Approver
          </button>
        </div>
      </div>

      <div className="my-4 flex gap-3">
        <select
          aria-label="Filter by Business Unit"
          value={businessUnitFilter}
          onChange={(event) => setBusinessUnitFilter(event.target.value)}
          className={filterClassName}
        >
          <option value="">Business Unit: All</option>
          {businessUnits.map((bu) => (
            <option key={bu.id} value={bu.name}>
              {bu.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Location"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          className={filterClassName}
        >
          <option value="">Location: All</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              {["Approver", "Level", "Department", "Business Unit", "Location"].map(
                (column) => (
                  <th key={column} className="px-4 py-3 text-xs font-bold text-white">
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No approvers assigned yet.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                >
                  <td className="px-4 py-3">{row.approverName}</td>
                  <td className="px-4 py-3">{row.level}</td>
                  <td className="px-4 py-3">{row.department}</td>
                  <td className="px-4 py-3">{row.businessUnit}</td>
                  <td className="px-4 py-3">{row.location}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approver-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
                />
                <div
                  aria-hidden
                  className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
                />
                <h2
                  id="approver-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  ADD APPROVER
                </h2>
                <p className="mt-1 text-xs text-white/80">{matrixType.name}</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModalOpen(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 px-8 py-7">
                <div>
                  <label htmlFor="approver-user" className={labelClassName}>
                    Approver
                  </label>
                  <select
                    id="approver-user"
                    required
                    value={approverId}
                    onChange={(event) => setApproverId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a user
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-level" className={labelClassName}>
                    Level
                  </label>
                  <select
                    id="approver-level"
                    required
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a level
                    </option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-department" className={labelClassName}>
                    Department
                  </label>
                  <select
                    id="approver-department"
                    required
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a department
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-business-unit" className={labelClassName}>
                    Business Unit
                  </label>
                  <select
                    id="approver-business-unit"
                    required
                    value={businessUnitId}
                    onChange={(event) => setBusinessUnitId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a business unit
                    </option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-location" className={labelClassName}>
                    Location
                  </label>
                  <select
                    id="approver-location"
                    required
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a location
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] disabled:pointer-events-none disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx"`
Expected: PASS — 9/9 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/settings/MatrixTypeApproverDetail.tsx" "app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx"
git commit -m "Add MatrixTypeApproverDetail component"
```

---

### Task 4: Wire the detail view into Settings

**Files:**
- Modify: `app/(authenticated)/settings/SettingsView.tsx`
- Modify: `app/(authenticated)/settings/page.tsx`
- Modify: `app/(authenticated)/settings/SettingsView.test.tsx`

**Interfaces:**
- Consumes: `MatrixTypeApproverDetail`, `ApproverAssignmentRow`, `UserOption` from `./MatrixTypeApproverDetail` (Task 3).
- Produces: nothing consumed by a later task — this is the last task in the plan.

- [ ] **Step 1: Extend `SettingsView.test.tsx`'s fixtures and add new test cases**

In `app/(authenticated)/settings/SettingsView.test.tsx`, add fixtures and update `renderView`:

```tsx
const approverAssignments = [
  {
    id: "a1",
    matrixTypeId: "mt1",
    approverName: "Jhon Caser",
    level: 1,
    department: "ICT",
    businessUnit: "Cawit",
    location: "Zamboanga",
  },
];
const users = [{ id: "u1", name: "Jhon Caser" }];

function renderView() {
  return render(
    <SettingsView
      matrixTypes={matrixTypes}
      departments={departments}
      businessUnits={businessUnits}
      locations={locations}
      approverAssignments={approverAssignments}
      users={users}
    />
  );
}
```

Add these two test cases at the end of the `describe("SettingsView", ...)` block, before the closing `});`:

```tsx
  it("shows the approver detail view when a Matrix Type row is clicked, and returns to the list on back", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Halfday" }));

    expect(screen.getByText("HALFDAY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ add approver/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Matrix Type" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /settings \/ matrix type/i }));
    expect(screen.getByRole("button", { name: "Matrix Type" })).toBeInTheDocument();
    expect(screen.queryByText("HALFDAY")).not.toBeInTheDocument();
  });

  it("shows that matrix type's assigned approvers in the detail view", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Halfday" }));
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run "app/(authenticated)/settings/SettingsView.test.tsx"`
Expected: FAIL — `getByRole("button", { name: "Halfday" })` not found (matrix type names aren't buttons yet), and `SettingsView` doesn't accept `approverAssignments`/`users` props yet (TypeScript error surfaces as a test failure or type-check failure).

- [ ] **Step 3: Make Matrix Type rows clickable and add the detail-view state to `SettingsView.tsx`**

In `app/(authenticated)/settings/SettingsView.tsx`, add the import at the top:

```tsx
import {
  MatrixTypeApproverDetail,
  type ApproverAssignmentRow,
  type UserOption,
} from "./MatrixTypeApproverDetail";
```

Change the `MatrixTypeTable` function to accept an `onSelect` prop and make each row's name a clickable button:

```tsx
function MatrixTypeTable({
  rows,
  onSelect,
}: {
  rows: MatrixTypeRow[];
  onSelect: (row: MatrixTypeRow) => void;
}) {
  const columns = ["Matrix Code", "Matrix Type", "Creator", "Date Created"];
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow">
      <table className="w-full border-collapse text-left text-sm text-slate-600">
        <thead>
          <tr className="bg-[#2C7001]">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-xs font-bold text-white">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                No matrix types yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
              >
                <td className="px-4 py-3">{row.matrixCode}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="font-semibold text-[#2C7001] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40 rounded"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="px-4 py-3">{row.creator}</td>
                <td className="px-4 py-3 text-slate-500">{row.createdAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Update the `SettingsView` component itself**

Change the `SettingsView` function's signature to accept the two new props and add `selectedMatrixTypeId` state:

```tsx
export function SettingsView({
  matrixTypes,
  departments,
  businessUnits,
  locations,
  approverAssignments,
  users,
}: {
  matrixTypes: MatrixTypeRow[];
  departments: ReferenceRow[];
  businessUnits: ReferenceRow[];
  locations: ReferenceRow[];
  approverAssignments: ApproverAssignmentRow[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("matrixType");
  const [selectedMatrixTypeId, setSelectedMatrixTypeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeLabel = TABS.find((tab) => tab.key === activeTab)!.label;
  const selectedMatrixType = matrixTypes.find((mt) => mt.id === selectedMatrixTypeId) ?? null;
```

(Everything else in the function body — `openModal`, `handleSubmit` — stays exactly as it is today, unchanged.)

- [ ] **Step 5: Replace the return statement's outer structure**

Replace the component's `return (...)` block (the whole JSX from `return (` to the final `);`) with:

```tsx
  return (
    <div className="w-full">
      {selectedMatrixType ? (
        <MatrixTypeApproverDetail
          matrixType={selectedMatrixType}
          assignments={approverAssignments.filter(
            (row) => row.matrixTypeId === selectedMatrixType.id
          )}
          users={users}
          departments={departments}
          businessUnits={businessUnits}
          locations={locations}
          onBack={() => setSelectedMatrixTypeId(null)}
        />
      ) : (
        <>
          <div className="mb-4">
            <h1 className="text-lg font-bold text-slate-800">Settings</h1>
            <p className="text-xs text-slate-500">Manage setup values used across the app</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500 transition-all duration-150 ${
                  activeTab === tab.key ? "border-l-[6px] bg-[#fbfdf9] text-[#2C7001]" : ""
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={openModal}
              className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              + Add {activeLabel}
            </button>
          </div>

          {activeTab === "matrixType" ? (
            <MatrixTypeTable
              rows={matrixTypes}
              onSelect={(row) => setSelectedMatrixTypeId(row.id)}
            />
          ) : (
            <SimpleTable
              label={activeLabel}
              rows={
                activeTab === "department"
                  ? departments
                  : activeTab === "businessUnit"
                    ? businessUnits
                    : locations
              }
            />
          )}

          {modalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
              className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
            >
              <div className="flex min-h-full items-center justify-center p-6">
                <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
                    <div
                      aria-hidden
                      className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
                    />
                    <div
                      aria-hidden
                      className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
                    />
                    <h2
                      id="settings-modal-title"
                      className="text-lg font-extrabold tracking-widest text-white"
                    >
                      ADD {activeLabel.toUpperCase()}
                    </h2>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setModalOpen(false)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4 px-8 py-7">
                    <div>
                      <label
                        htmlFor="setup-name"
                        className="mb-1 block text-xs font-semibold text-slate-600"
                      >
                        Name
                      </label>
                      <input
                        id="setup-name"
                        type="text"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]"
                      />
                    </div>
                    {error && (
                      <p role="alert" className="text-xs text-red-600">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] disabled:pointer-events-none disabled:opacity-60"
                    >
                      {submitting ? "Saving…" : "Save"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run `SettingsView.test.tsx` to verify all tests pass**

Run: `npx vitest run "app/(authenticated)/settings/SettingsView.test.tsx"`
Expected: PASS — 8/8 tests (6 existing + 2 new).

- [ ] **Step 7: Update `page.tsx` to fetch and pass the two new props**

Replace the full contents of `app/(authenticated)/settings/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "./SettingsView";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canManageReferenceData(session)) {
    redirect("/dashboard");
  }

  const [matrixTypes, departments, businessUnits, locations, matrixTypeApprovers, users] =
    await Promise.all([
      prisma.matrixType.findMany({
        orderBy: { matrixCode: "asc" },
        include: { creator: { select: { email: true } } },
      }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.matrixTypeApprover.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          approver: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
          businessUnit: { select: { name: true } },
          location: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

  const matrixTypeRows = matrixTypes.map((row) => ({
    id: row.id,
    matrixCode: row.matrixCode,
    name: row.name,
    creator: row.creator.email,
    createdAt: row.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  const approverAssignments = matrixTypeApprovers.map((row) => ({
    id: row.id,
    matrixTypeId: row.matrixTypeId,
    approverName: `${row.approver.firstName} ${row.approver.lastName}`,
    level: row.level,
    department: row.department.name,
    businessUnit: row.businessUnit.name,
    location: row.location.name,
  }));

  const userOptions = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <SettingsView
          matrixTypes={matrixTypeRows}
          departments={departments}
          businessUnits={businessUnits}
          locations={locations}
          approverAssignments={approverAssignments}
          users={userOptions}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: PASS on every file except the known `prisma/seed.test.ts` baseline failure (seed admin has a real, user-set password). No other file should fail or change count from the pre-task baseline.

- [ ] **Step 9: Run the build**

Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 10: Clear `.next` before any dev-server verification**

Since Step 9 just ran `npm run build`, its production artifacts in `.next/` will collide with a subsequently started `next dev` (a known gotcha on this branch — see the handoff doc §5). If you or the controller start a dev server after this task to verify manually, stop any running dev server, delete `.next`, then start `npm run dev` fresh before relying on it.

- [ ] **Step 11: Commit**

```bash
git add "app/(authenticated)/settings/SettingsView.tsx" "app/(authenticated)/settings/page.tsx" "app/(authenticated)/settings/SettingsView.test.tsx"
git commit -m "Wire Matrix Type Approver detail view into Settings"
```
