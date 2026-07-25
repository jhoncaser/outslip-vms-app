# Visitor Pass Matrix-Type Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When "Visitor Pass" is selected as the matrix type in the Add Transaction modal, swap in a Visitor-Pass-specific set of fields (Visitor Type, Person to Meet, Department, Location, Transport Type, Plate No., plus the reused Planned Date/Planned Time/Reason) instead of the generic field set, and show the 6 new fields as columns in the Open Transactions table.

**Architecture:** 6 new nullable columns on the existing `Transaction` model (one of them a real FK to `Department`), two new fixed-option-list files matching the existing `lib/businessUnitOptions.ts` convention, an extended (still fully optional) Zod schema and API route, and a client-side conditional render in `TransactionsView.tsx` that swaps field sets based on the selected matrix type's `name`.

**Tech Stack:** Next.js 16 App Router (server components + client components), Prisma, Zod, Tailwind CSS v4, Vitest + Testing Library.

## Global Constraints

- **Only `"Visitor Pass"` (exact name match) gets the custom field set.** Every other matrix type keeps today's form and table exactly as-is.
- **All new fields stay optional** — no required-field validation, client or server side.
- **Reuse, don't duplicate:** `plannedDate`, `plannedTime`, `reason` are reused as-is — no schema change for these three, they just get shown in the Visitor Pass field order too.
- **6 new nullable `Transaction` columns, exact names and types:** `visitorType String?`, `personToMeet String?`, `departmentId String?` (FK → `Department`, nullable) with relation field `department`, `visitLocation String?`, `transportType String?`, `plateNo String?`.
- **`visitorType` fixed list, exact values and order:** Applicant, Buyer, Contractor, Supplier, Visitor — `lib/visitorTypeOptions.ts`, exported as `VISITOR_TYPE_OPTIONS`.
- **`transportType` fixed list, exact values and order:** Car, Truck, Bicycle, Motorcycle, Walk-In — `lib/transportTypeOptions.ts`, exported as `TRANSPORT_TYPE_OPTIONS`.
- **The UI label is "Location" but the field is `visitLocation` everywhere in code** (Prisma column, Zod schema key, API body key, `TransactionRow` display key stays `location` — see Task 3) — deliberately distinct from the existing `Location` reference-data model, which this field has no relation to.
- **Visitor Pass field order in the Add Transaction modal, exact:** Visitor Type, Planned Date, Planned Time, Person to Meet, Department, Reason, Location, Transport Type, Plate No.
- **Hidden when Visitor Pass is selected:** Return Time, Origin Business Unit, Enroute to Other Business Unit.
- **6 new table columns, exact names and position:** Visitor Type, Person to Meet, Department, Location, Transport Type, Plate No. — inserted directly after "Reason" and before "Created By". Non-Visitor-Pass rows show `"—"`.
- **Do not add P2003 field-name discrimination.** Any FK failure in `POST /api/transactions` (bad `matrixTypeId` or bad `departmentId`) keeps returning the existing `"Invalid transaction type"` 400 message, unchanged. This matches the precedent already set in `app/api/matrix-type-approvers/route.ts`, which returns one generic message for its five possible FKs rather than discriminating by field.
- **Migration is additive/nullable only** — no backfill needed.

---

### Task 1: Schema, migration, and fixed-option files

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/visitorTypeOptions.ts`
- Create: `lib/transportTypeOptions.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (consumed by Task 2 and Task 3): Prisma model `Transaction` gains `visitorType String?`, `personToMeet String?`, `department Department? @relation(fields: [departmentId], references: [id])` + `departmentId String?`, `visitLocation String?`, `transportType String?`, `plateNo String?`. `Department` gains back-relation `transactions Transaction[]`. `VISITOR_TYPE_OPTIONS` (`lib/visitorTypeOptions.ts`) and `TRANSPORT_TYPE_OPTIONS` (`lib/transportTypeOptions.ts`), both `as const` string tuples.

- [ ] **Step 1: Add the new fields to `Transaction` and the back-relation to `Department`**

In `prisma/schema.prisma`, change the `Department` model to:

```prisma
model Department {
  id                  String               @id @default(cuid())
  name                String               @unique
  users               User[]
  matrixTypeApprovers MatrixTypeApprover[]
  transactions        Transaction[]
}
```

And change the `Transaction` model to:

```prisma
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

  plannedDate          DateTime? @db.Date
  plannedTime          DateTime? @db.Time
  returnTime           DateTime? @db.Time
  originBusinessUnit   String?
  enrouteBusinessUnits String[]  @default([])
  reason               String?

  visitorType  String?
  personToMeet String?

  department   Department? @relation(fields: [departmentId], references: [id])
  departmentId String?

  visitLocation String?
  transportType String?
  plateNo       String?
}
```

Leave every other model untouched.

- [ ] **Step 2: Format and generate**

Run: `npx prisma format`
Run: `npx prisma generate`
Expected: both complete with no errors; `@prisma/client` now exposes the 6 new fields on `prisma.transaction` and `department` on `prisma.department`.

- [ ] **Step 3: Apply the migration to the live Neon DB**

Run: `npx prisma migrate dev --name add_visitor_pass_fields`
Expected: a new migration folder under `prisma/migrations/`, output ending in `Your database is now in sync with your schema.`

- [ ] **Step 4: Write the two fixed-option files**

Create `lib/visitorTypeOptions.ts`:

```ts
export const VISITOR_TYPE_OPTIONS = [
  "Applicant",
  "Buyer",
  "Contractor",
  "Supplier",
  "Visitor",
] as const;
```

Create `lib/transportTypeOptions.ts`:

```ts
export const TRANSPORT_TYPE_OPTIONS = [
  "Car",
  "Truck",
  "Bicycle",
  "Motorcycle",
  "Walk-In",
] as const;
```

- [ ] **Step 5: Verify the schema compiles**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/visitorTypeOptions.ts lib/transportTypeOptions.ts
git commit -m "Add Visitor Pass transaction fields to schema"
```

---

### Task 2: Validation and API route

**Files:**
- Modify: `lib/validation/transaction.ts`
- Modify: `lib/validation/transaction.test.ts`
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/route.test.ts`

**Interfaces:**
- Consumes: `VISITOR_TYPE_OPTIONS` (`lib/visitorTypeOptions.ts`), `TRANSPORT_TYPE_OPTIONS` (`lib/transportTypeOptions.ts`), and the 6 new `Transaction` fields — all from Task 1.
- Produces (consumed by Task 3): `POST /api/transactions` accepts 6 additional optional body fields — `visitorType` (one of `VISITOR_TYPE_OPTIONS`), `personToMeet` (string), `departmentId` (string), `visitLocation` (string), `transportType` (one of `TRANSPORT_TYPE_OPTIONS`), `plateNo` (string) — alongside the existing fields, unchanged response shapes/status codes.

- [ ] **Step 1: Update the failing/extended validation tests**

Replace the full contents of `lib/validation/transaction.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { transactionSchema } from "./transaction";

describe("transactionSchema", () => {
  it("accepts a valid matrixTypeId with no other fields", () => {
    const result = transactionSchema.safeParse({ matrixTypeId: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty matrixTypeId", () => {
    const result = transactionSchema.safeParse({ matrixTypeId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing matrixTypeId", () => {
    const result = transactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a body with all fields populated, including the Visitor Pass fields", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      plannedDate: "2026-07-25",
      plannedTime: "09:00",
      returnTime: "17:00",
      originBusinessUnit: "Cawit",
      enrouteBusinessUnits: ["Alpha", "Delta"],
      reason: "Client meeting",
      visitorType: "Supplier",
      personToMeet: "Analyn Gentizon",
      departmentId: "dept123",
      visitLocation: "Lobby, Room 204",
      transportType: "Car",
      plateNo: "ABC-1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an originBusinessUnit value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      originBusinessUnit: "Not A Real Unit",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an enrouteBusinessUnits value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      enrouteBusinessUnits: ["Alpha", "Not A Real Unit"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a visitorType value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      visitorType: "Not A Real Type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a transportType value outside the fixed list", () => {
    const result = transactionSchema.safeParse({
      matrixTypeId: "abc123",
      transportType: "Not A Real Type",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/validation/transaction.test.ts`
Expected: FAIL — the two new rejection tests fail because `visitorType`/`transportType` aren't in the schema yet (they currently parse as unknown extra keys and succeed).

- [ ] **Step 3: Update the validation schema**

Replace the full contents of `lib/validation/transaction.ts`:

```ts
import { z } from "zod";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";
import { VISITOR_TYPE_OPTIONS } from "@/lib/visitorTypeOptions";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedTime: z.string().optional(),
  returnTime: z.string().optional(),
  originBusinessUnit: z.enum(BUSINESS_UNIT_OPTIONS).optional(),
  enrouteBusinessUnits: z.array(z.enum(BUSINESS_UNIT_OPTIONS)).optional(),
  reason: z.string().optional(),
  visitorType: z.enum(VISITOR_TYPE_OPTIONS).optional(),
  personToMeet: z.string().optional(),
  departmentId: z.string().optional(),
  visitLocation: z.string().optional(),
  transportType: z.enum(TRANSPORT_TYPE_OPTIONS).optional(),
  plateNo: z.string().optional(),
});
```

- [ ] **Step 4: Run validation tests to verify they pass**

Run: `npx vitest run lib/validation/transaction.test.ts`
Expected: PASS — 8/8 tests.

- [ ] **Step 5: Update the failing/extended route tests**

Replace the full contents of `app/api/transactions/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let userToken: string;
let userId: string;
let matrixTypeId: string;
let departmentId: string;

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/transactions", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/transactions", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    departmentId = department.id;

    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });

    const user = await prisma.user.upsert({
      where: { email: "transactions-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Trans",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "transactions-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    userId = user.id;

    userToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Txn Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-TXNFIXTURE",
        name: "Txn Fixture Matrix Type",
        creatorId: user.id,
      },
    });
    matrixTypeId = matrixType.id;

    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, { matrixTypeId }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty matrixTypeId", async () => {
    const response = await POST(
      requestWithCookie(userToken, { matrixTypeId: "" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a non-existent matrixTypeId", async () => {
    const response = await POST(
      requestWithCookie(userToken, { matrixTypeId: "nonexistent-id" })
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toMatch(/invalid transaction type/i);
  });

  it("creates a transaction with a sequential code, Open status, and the session user as creator", async () => {
    const before = await prisma.transaction.count();

    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.transactionCode).toBe(`OT-${String(before + 1).padStart(3, "0")}`);
    expect(body.matrixTypeId).toBe(matrixTypeId);

    const created = await prisma.transaction.findUnique({
      where: { id: body.id },
      include: { status: true },
    });
    expect(created?.creatorId).toBe(userId);
    expect(created?.status.name).toBe("Open");
  });

  it("creates a transaction with all optional fields populated, including Visitor Pass fields, and round-trips them correctly", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        returnTime: "17:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Alpha", "Delta"],
        reason: "Client meeting",
        visitorType: "Supplier",
        personToMeet: "Analyn Gentizon",
        departmentId,
        visitLocation: "Lobby, Room 204",
        transportType: "Car",
        plateNo: "ABC-1234",
      })
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate?.toISOString().slice(0, 10)).toBe("2026-07-25");
    expect(created.plannedTime?.toISOString().slice(11, 16)).toBe("09:00");
    expect(created.returnTime?.toISOString().slice(11, 16)).toBe("17:00");
    expect(created.originBusinessUnit).toBe("Cawit");
    expect(created.enrouteBusinessUnits).toEqual(["Alpha", "Delta"]);
    expect(created.reason).toBe("Client meeting");
    expect(created.visitorType).toBe("Supplier");
    expect(created.personToMeet).toBe("Analyn Gentizon");
    expect(created.departmentId).toBe(departmentId);
    expect(created.visitLocation).toBe("Lobby, Room 204");
    expect(created.transportType).toBe("Car");
    expect(created.plateNo).toBe("ABC-1234");
  });

  it("creates a transaction successfully when all optional fields are omitted", async () => {
    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    const created = await prisma.transaction.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(created.plannedDate).toBeNull();
    expect(created.plannedTime).toBeNull();
    expect(created.returnTime).toBeNull();
    expect(created.originBusinessUnit).toBeNull();
    expect(created.enrouteBusinessUnits).toEqual([]);
    expect(created.reason).toBeNull();
    expect(created.visitorType).toBeNull();
    expect(created.personToMeet).toBeNull();
    expect(created.departmentId).toBeNull();
    expect(created.visitLocation).toBeNull();
    expect(created.transportType).toBeNull();
    expect(created.plateNo).toBeNull();
  });

  it("returns 400 for an originBusinessUnit value outside the fixed list", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        originBusinessUnit: "Not A Real Unit",
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a visitorType value outside the fixed list", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId,
        visitorType: "Not A Real Type",
      })
    );
    expect(response.status).toBe(400);
  });

  it("retries with a new code when the generated transaction code collides", async () => {
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });
    const before = await prisma.transaction.count();
    const staleCode = `OT-${String(before + 1).padStart(3, "0")}`;

    await prisma.transaction.create({
      data: {
        transactionCode: staleCode,
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });

    const countSpy = vi
      .spyOn(prisma.transaction, "count")
      .mockResolvedValueOnce(before);

    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.transactionCode).not.toBe(staleCode);

    countSpy.mockRestore();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 6: Run route tests to verify the new/changed ones fail**

Run: `npx vitest run app/api/transactions/route.test.ts`
Expected: FAIL — the "all optional fields populated" and "omitted" tests fail their new Visitor Pass field assertions, because `route.ts` doesn't pass those fields to `prisma.transaction.create` yet. (The schema itself was already updated in Step 3, so the `visitorType` 400 test already passes at this point — only the persistence assertions are red.)

- [ ] **Step 7: Update the route**

In `app/api/transactions/route.ts`, replace the `data: { ... }` object inside `prisma.transaction.create` with:

```ts
        data: {
          transactionCode,
          matrixTypeId: parsed.data.matrixTypeId,
          statusId: openStatus.id,
          creatorId: session.sub,
          plannedDate: parsed.data.plannedDate
            ? new Date(parsed.data.plannedDate)
            : undefined,
          plannedTime: parsed.data.plannedTime
            ? new Date(`1970-01-01T${parsed.data.plannedTime}:00.000Z`)
            : undefined,
          returnTime: parsed.data.returnTime
            ? new Date(`1970-01-01T${parsed.data.returnTime}:00.000Z`)
            : undefined,
          originBusinessUnit: parsed.data.originBusinessUnit,
          enrouteBusinessUnits: parsed.data.enrouteBusinessUnits ?? [],
          reason: parsed.data.reason,
          visitorType: parsed.data.visitorType,
          personToMeet: parsed.data.personToMeet,
          departmentId: parsed.data.departmentId,
          visitLocation: parsed.data.visitLocation,
          transportType: parsed.data.transportType,
          plateNo: parsed.data.plateNo,
        },
```

Leave the rest of the file (imports, the retry loop, the P2002/P2003 error handling) untouched — per Global Constraints, do not add any field-name discrimination to the P2003 branch.

- [ ] **Step 8: Run route tests to verify they pass**

Run: `npx vitest run app/api/transactions/route.test.ts`
Expected: PASS — 9/9 tests.

- [ ] **Step 9: Commit**

```bash
git add lib/validation/transaction.ts lib/validation/transaction.test.ts app/api/transactions/route.ts app/api/transactions/route.test.ts
git commit -m "Accept Visitor Pass fields in POST /api/transactions"
```

---

### Task 3: Add Transaction modal field-set swap and table columns

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `VISITOR_TYPE_OPTIONS` (`lib/visitorTypeOptions.ts`), `TRANSPORT_TYPE_OPTIONS` (`lib/transportTypeOptions.ts`) from Task 1; the body field names accepted by `POST /api/transactions` from Task 2.
- Produces (consumed by Task 4): `TransactionsView` requires a new prop `departments: { id: string; name: string }[]`; `TransactionRow` type gains `visitorType: string`, `personToMeet: string`, `department: string`, `location: string`, `transportType: string`, `plateNo: string`.

- [ ] **Step 1: Update the test file first**

Replace the full contents of `app/(authenticated)/transactions/open/TransactionsView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TransactionsView } from "./TransactionsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const transactions = [
  {
    id: "t1",
    transactionCode: "OT-001",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Halfday",
    plannedDate: "Jul 25, 2026",
    plannedTime: "9:00 AM",
    returnTime: "5:00 PM",
    originBusinessUnit: "Cawit",
    enrouteBusinessUnits: "Alpha, Delta",
    reason: "Client meeting",
    visitorType: "—",
    personToMeet: "—",
    department: "—",
    location: "—",
    transportType: "—",
    plateNo: "—",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
const visitorPassTransactions = [
  {
    id: "t2",
    transactionCode: "OT-002",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Visitor Pass",
    plannedDate: "Jul 26, 2026",
    plannedTime: "10:30 AM",
    returnTime: "—",
    originBusinessUnit: "—",
    enrouteBusinessUnits: "—",
    reason: "Product demo for a prospective supplier",
    visitorType: "Supplier",
    personToMeet: "Analyn Gentizon",
    department: "ICT",
    location: "Lobby, Room 204",
    transportType: "Car",
    plateNo: "ABC-1234",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 25, 2026",
  },
];
const matrixTypes = [
  { id: "mt1", name: "Halfday" },
  { id: "mt2", name: "Undertime" },
  { id: "mt3", name: "Visitor Pass" },
];
const departments = [
  { id: "d1", name: "ICT" },
  { id: "d2", name: "HR" },
];

function renderView(currentUserBusinessUnit = "") {
  return render(
    <TransactionsView
      transactions={transactions}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
      departments={departments}
    />
  );
}

describe("TransactionsView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ id: "new1" }),
        })
      )
    );
  });

  it("renders the transactions table", () => {
    renderView();
    expect(
      screen.getByRole("columnheader", { name: "Transaction Type" })
    ).toBeInTheDocument();
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });

  it("renders the additional fields as table columns before Created By, including the Visitor Pass columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Planned Date",
      "Planned Time",
      "Return Time",
      "Origin Business Unit",
      "Enroute to Other Business Unit",
      "Reason",
      "Visitor Type",
      "Person to Meet",
      "Department",
      "Location",
      "Transport Type",
      "Plate No.",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Delta")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
  });

  it("renders populated Visitor Pass column values for a Visitor Pass row", () => {
    render(
      <TransactionsView
        transactions={visitorPassTransactions}
        matrixTypes={matrixTypes}
        currentUserBusinessUnit=""
        departments={departments}
      />
    );
    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("Lobby, Room 204")).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
  });

  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });

  it("opens an enlarged QR view when the thumbnail is clicked, and closes it via the X", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the enlarged QR view open on backdrop click and Escape", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the modal and lists matrix type options", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Halfday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Undertime" })).toBeInTheDocument();
  });

  it("renders the additional optional fields in the Add Transaction modal", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /enroute to other business unit/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Delta" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
  });

  it("shows the Visitor Pass field set and hides Return Time, Origin Business Unit, and Enroute to Other Business Unit when Visitor Pass is selected", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt3" },
    });

    expect(screen.getByLabelText(/^visitor type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/person to meet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^transport type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plate no\./i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the default field set when a non-Visitor-Pass matrix type is selected", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("includes populated optional fields in the submitted body", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Client meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt1",
            plannedDate: "2026-07-25",
            reason: "Client meeting",
          }),
        })
      )
    );
  });

  it("submits populated Visitor Pass fields in the request body", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt3" },
    });
    fireEvent.change(screen.getByLabelText(/^visitor type$/i), {
      target: { value: "Supplier" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-26" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText(/person to meet/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "d1" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Product demo for a prospective supplier" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "Lobby, Room 204" },
    });
    fireEvent.change(screen.getByLabelText(/^transport type$/i), {
      target: { value: "Car" },
    });
    fireEvent.change(screen.getByLabelText(/plate no\./i), {
      target: { value: "ABC-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt3",
            plannedDate: "2026-07-26",
            plannedTime: "10:30",
            reason: "Product demo for a prospective supplier",
            visitorType: "Supplier",
            personToMeet: "Analyn Gentizon",
            departmentId: "d1",
            visitLocation: "Lobby, Room 204",
            transportType: "Car",
            plateNo: "ABC-1234",
          }),
        })
      )
    );
  });

  it("includes all checked values when submitting the Enroute to Other Business Unit checkboxes", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Delta" }));

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            '"enrouteBusinessUnits":["Alpha","Delta"]'
          ),
        })
      )
    );
  });

  it("submits the selected matrix type to /api/transactions", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2" }),
        })
      )
    );
  });

  it("pre-fills Origin Business Unit with the current user's business unit when it's a valid option", () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("Cawit");
  });

  it("still allows changing the pre-filled Origin Business Unit before submitting", async () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Delta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2", originBusinessUnit: "Delta" }),
        })
      )
    );
  });

  it("leaves Origin Business Unit unset when the current user's business unit isn't one of the fixed options", () => {
    renderView("MSC");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("");
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — `TransactionsView` doesn't accept a `departments` prop yet, the Visitor Pass fields don't exist, and the table doesn't have the 6 new columns.

- [ ] **Step 3: Update the component**

Replace the full contents of `app/(authenticated)/transactions/open/TransactionsView.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";
import { VISITOR_TYPE_OPTIONS } from "@/lib/visitorTypeOptions";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export type TransactionRow = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  plannedDate: string;
  plannedTime: string;
  returnTime: string;
  originBusinessUnit: string;
  enrouteBusinessUnits: string;
  reason: string;
  visitorType: string;
  personToMeet: string;
  department: string;
  location: string;
  transportType: string;
  plateNo: string;
  createdBy: string;
  statusName: string;
  createdAt: string;
};
export type MatrixTypeOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };

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

function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const columns = [
    "QR",
    "Code",
    "Transaction Type",
    "Planned Date",
    "Planned Time",
    "Return Time",
    "Origin Business Unit",
    "Enroute to Other Business Unit",
    "Reason",
    "Visitor Type",
    "Person to Meet",
    "Department",
    "Location",
    "Transport Type",
    "Plate No.",
    "Created By",
    "Status",
    "Date Filed",
  ];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No open transactions yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEnlargedCode(row.transactionCode)}
                      className="h-12 w-12 overflow-hidden rounded border border-slate-200 transition-colors hover:border-[#2C7001] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
                    >
                      <img
                        src={row.qrDataUrl}
                        alt={`QR code for transaction ${row.transactionCode}`}
                        className="h-full w-full"
                      />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.transactionCode}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.matrixTypeName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.plannedDate}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.plannedTime}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.returnTime}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.originBusinessUnit}</td>
                  <td className="max-w-[220px] px-4 py-3">{row.enrouteBusinessUnits}</td>
                  <td className="max-w-[220px] px-4 py-3">{row.reason}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.visitorType}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.personToMeet}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.department}</td>
                  <td className="max-w-[220px] px-4 py-3">{row.location}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.transportType}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.plateNo}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.createdBy}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {row.statusName}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enlargedRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl">
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
                  id="qr-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {enlargedRow.transactionCode}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setEnlargedCode(null)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex justify-center px-8 py-7">
                <img
                  src={enlargedRow.qrDataUrl}
                  alt={`QR code for transaction ${enlargedRow.transactionCode}`}
                  className="h-56 w-56"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputClassName =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";
const labelClassName = "mb-1 block text-xs font-semibold text-slate-600";

export function TransactionsView({
  transactions,
  matrixTypes,
  currentUserBusinessUnit,
  departments,
}: {
  transactions: TransactionRow[];
  matrixTypes: MatrixTypeOption[];
  currentUserBusinessUnit: string;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [matrixTypeId, setMatrixTypeId] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [plannedTime, setPlannedTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [originBusinessUnit, setOriginBusinessUnit] = useState("");
  const [enrouteBusinessUnits, setEnrouteBusinessUnits] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [visitorType, setVisitorType] = useState("");
  const [personToMeet, setPersonToMeet] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [visitLocation, setVisitLocation] = useState("");
  const [transportType, setTransportType] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isVisitorPass =
    matrixTypes.find((option) => option.id === matrixTypeId)?.name === "Visitor Pass";

  function openModal() {
    setMatrixTypeId("");
    setPlannedDate("");
    setPlannedTime("");
    setReturnTime("");
    setOriginBusinessUnit(
      (BUSINESS_UNIT_OPTIONS as readonly string[]).includes(currentUserBusinessUnit)
        ? currentUserBusinessUnit
        : ""
    );
    setEnrouteBusinessUnits([]);
    setReason("");
    setVisitorType("");
    setPersonToMeet("");
    setDepartmentId("");
    setVisitLocation("");
    setTransportType("");
    setPlateNo("");
    setError("");
    setModalOpen(true);
  }

  function toggleEnrouteBusinessUnit(option: string) {
    setEnrouteBusinessUnits((prev) =>
      prev.includes(option)
        ? prev.filter((value) => value !== option)
        : [...prev, option]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const body: Record<string, unknown> = { matrixTypeId };
    if (plannedDate) body.plannedDate = plannedDate;
    if (plannedTime) body.plannedTime = plannedTime;
    if (returnTime) body.returnTime = returnTime;
    if (originBusinessUnit) body.originBusinessUnit = originBusinessUnit;
    if (enrouteBusinessUnits.length > 0) body.enrouteBusinessUnits = enrouteBusinessUnits;
    if (reason) body.reason = reason;
    if (visitorType) body.visitorType = visitorType;
    if (personToMeet) body.personToMeet = personToMeet;
    if (departmentId) body.departmentId = departmentId;
    if (visitLocation) body.visitLocation = visitLocation;
    if (transportType) body.transportType = transportType;
    if (plateNo) body.plateNo = plateNo;

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Open Transaction</h1>
          <p className="text-xs text-slate-500">Filed requests awaiting further action</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Add Transaction
        </button>
      </div>

      <TransactionsTable rows={transactions} />

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-modal-title"
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
                  id="transaction-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  ADD TRANSACTION
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
              <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-8 py-7">
                <div>
                  <label htmlFor="transaction-type" className={labelClassName}>
                    Transaction Type
                  </label>
                  <select
                    id="transaction-type"
                    required
                    value={matrixTypeId}
                    onChange={(event) => setMatrixTypeId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a transaction type
                    </option>
                    {matrixTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isVisitorPass ? (
                  <>
                    <div>
                      <label htmlFor="visitor-type" className={labelClassName}>
                        Visitor Type
                      </label>
                      <select
                        id="visitor-type"
                        value={visitorType}
                        onChange={(event) => setVisitorType(event.target.value)}
                        className={inputClassName}
                      >
                        <option value="" disabled>
                          Select a visitor type
                        </option>
                        {VISITOR_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="planned-date" className={labelClassName}>
                        Planned Date
                      </label>
                      <input
                        id="planned-date"
                        type="date"
                        value={plannedDate}
                        onChange={(event) => setPlannedDate(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="planned-time" className={labelClassName}>
                        Planned Time
                      </label>
                      <input
                        id="planned-time"
                        type="time"
                        value={plannedTime}
                        onChange={(event) => setPlannedTime(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="person-to-meet" className={labelClassName}>
                        Person to Meet
                      </label>
                      <input
                        id="person-to-meet"
                        type="text"
                        value={personToMeet}
                        onChange={(event) => setPersonToMeet(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="visitor-department" className={labelClassName}>
                        Department
                      </label>
                      <select
                        id="visitor-department"
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
                      <label htmlFor="reason" className={labelClassName}>
                        Reason
                      </label>
                      <textarea
                        id="reason"
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="visit-location" className={labelClassName}>
                        Location
                      </label>
                      <input
                        id="visit-location"
                        type="text"
                        value={visitLocation}
                        onChange={(event) => setVisitLocation(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="transport-type" className={labelClassName}>
                        Transport Type
                      </label>
                      <select
                        id="transport-type"
                        value={transportType}
                        onChange={(event) => setTransportType(event.target.value)}
                        className={inputClassName}
                      >
                        <option value="" disabled>
                          Select a transport type
                        </option>
                        {TRANSPORT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="plate-no" className={labelClassName}>
                        Plate No.
                      </label>
                      <input
                        id="plate-no"
                        type="text"
                        value={plateNo}
                        onChange={(event) => setPlateNo(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="planned-date" className={labelClassName}>
                        Planned Date
                      </label>
                      <input
                        id="planned-date"
                        type="date"
                        value={plannedDate}
                        onChange={(event) => setPlannedDate(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="planned-time" className={labelClassName}>
                        Planned Time
                      </label>
                      <input
                        id="planned-time"
                        type="time"
                        value={plannedTime}
                        onChange={(event) => setPlannedTime(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="return-time" className={labelClassName}>
                        Return Time
                      </label>
                      <input
                        id="return-time"
                        type="time"
                        value={returnTime}
                        onChange={(event) => setReturnTime(event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label htmlFor="origin-business-unit" className={labelClassName}>
                        Origin Business Unit
                      </label>
                      <select
                        id="origin-business-unit"
                        value={originBusinessUnit}
                        onChange={(event) => setOriginBusinessUnit(event.target.value)}
                        className={inputClassName}
                      >
                        <option value="" disabled>
                          Select a business unit
                        </option>
                        {BUSINESS_UNIT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <fieldset>
                      <legend className={labelClassName}>Enroute to Other Business Unit</legend>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded border border-slate-300 p-3">
                        {BUSINESS_UNIT_OPTIONS.map((option) => (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={enrouteBusinessUnits.includes(option)}
                              onChange={() => toggleEnrouteBusinessUnit(option)}
                              className="h-4 w-4 rounded border-slate-300 text-[#2C7001] focus:ring-1 focus:ring-[#2C7001]"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div>
                      <label htmlFor="reason" className={labelClassName}>
                        Reason
                      </label>
                      <textarea
                        id="reason"
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                  </>
                )}

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

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS — 18/18 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Add Visitor Pass field-set swap and table columns to TransactionsView"
```

---

### Task 4: Wire departments and the new fields into the transactions page

**Files:**
- Modify: `app/(authenticated)/transactions/open/page.tsx`

**Interfaces:**
- Consumes: `DepartmentOption` shape and the 6 new `TransactionRow` fields from Task 3; `department` relation and the 6 new `Transaction` columns from Task 1.
- Produces: nothing consumed by a later task — this is the last task in the plan.

- [ ] **Step 1: Replace the full contents of `page.tsx`**

Replace the full contents of `app/(authenticated)/transactions/open/page.tsx`:

```tsx
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { TransactionsView } from "./TransactionsView";

export default async function OpenTransactionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const [transactions, matrixTypes, currentUser, departments] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: { name: "Open" } },
      orderBy: { createdAt: "desc" },
      include: {
        matrixType: { select: { name: true } },
        status: { select: { name: true } },
        creator: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.matrixType.findMany({ orderBy: { name: "asc" } }),
    session
      ? prisma.user.findUnique({
          where: { id: session.sub },
          select: { businessUnit: { select: { name: true } } },
        })
      : null,
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const currentUserBusinessUnit = currentUser?.businessUnit.name ?? "";

  const transactionRows = await Promise.all(
    transactions.map(async (row) => ({
      id: row.id,
      transactionCode: row.transactionCode,
      qrDataUrl: await QRCode.toDataURL(row.transactionCode, {
        width: 240,
        margin: 1,
      }),
      matrixTypeName: row.matrixType.name,
      plannedDate: row.plannedDate
        ? row.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
      plannedTime: row.plannedTime
        ? row.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      returnTime: row.returnTime
        ? row.returnTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      originBusinessUnit: row.originBusinessUnit ?? "—",
      enrouteBusinessUnits:
        row.enrouteBusinessUnits.length > 0 ? row.enrouteBusinessUnits.join(", ") : "—",
      reason: row.reason ?? "—",
      visitorType: row.visitorType ?? "—",
      personToMeet: row.personToMeet ?? "—",
      department: row.department?.name ?? "—",
      location: row.visitLocation ?? "—",
      transportType: row.transportType ?? "—",
      plateNo: row.plateNo ?? "—",
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
  );

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <TransactionsView
          transactions={transactionRows}
          matrixTypes={matrixTypes}
          currentUserBusinessUnit={currentUserBusinessUnit}
          departments={departments}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS on every file except the known `prisma/seed.test.ts` baseline failure(s) already documented in the branch handoff (seed admin password, and any live-DB reference-data drift from manual testing). No other file should fail or change count from the pre-task baseline.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 4: Clear `.next` before any dev-server verification**

Since Step 3 just ran `npm run build`, its production artifacts in `.next/` will collide with a subsequently started `next dev` (known gotcha on this branch — see the handoff doc). If verifying manually afterward, stop any running dev server, delete `.next`, then start `npm run dev` fresh.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/transactions/open/page.tsx"
git commit -m "Wire departments and Visitor Pass fields into the transactions page"
```
