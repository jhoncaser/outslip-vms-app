# Transaction Required Fields by Matrix Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every matrix type shows (and requires) a specific subset of the existing Transaction fields in the Add Transaction form, enforced both client-side (fast feedback) and server-side (the real gate).

**Architecture:** A single shared config file (`lib/transactionFieldSets.ts`) maps each matrix type name to its ordered list of required field keys, plus a `findMissingRequiredField` helper. Both `TransactionsView.tsx` (client form) and `app/api/transactions/route.ts` (server) import this one config — no duplicated logic.

**Tech Stack:** Next.js 16 (App Router), React (client component), Prisma, Zod, Vitest + Testing Library.

## Global Constraints

- No new database fields/columns/migrations — every field involved already exists on `Transaction`.
- For every matrix type covered in this round, "shown" and "required" are the same set — there is no field that's shown but optional.
- Field order within each type follows the array order defined in `TRANSACTION_FIELD_SETS` (already matches the existing canonical order in the code; Visitor Pass's order is unchanged from what's already implemented).
- No native HTML `required` attributes on the per-type fields (the Enroute to Other Business Unit checkbox group can't express "at least one" that way) — all required-field validation goes through `findMissingRequiredField`, both client and server.
- A matrix type whose name isn't a key in `TRANSACTION_FIELD_SETS` requires nothing extra (empty field set) — this must not throw or crash.
- Error messages follow the pattern `` `${label} is required for this transaction type` `` exactly, using `TRANSACTION_FIELD_LABELS` for the label.

---

### Task 1: Shared field-set config

**Files:**
- Create: `lib/transactionFieldSets.ts`
- Test: `lib/transactionFieldSets.test.ts`

**Interfaces:**
- Produces: `TransactionFieldKey` (union type), `TRANSACTION_FIELD_SETS: Record<string, readonly TransactionFieldKey[]>`, `TRANSACTION_FIELD_LABELS: Record<TransactionFieldKey, string>`, `findMissingRequiredField(matrixTypeName: string, values: Partial<Record<TransactionFieldKey, string | string[] | undefined>>): TransactionFieldKey | null` — all consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the failing test file**

Create `lib/transactionFieldSets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TRANSACTION_FIELD_SETS,
  TRANSACTION_FIELD_LABELS,
  findMissingRequiredField,
} from "./transactionFieldSets";

describe("TRANSACTION_FIELD_SETS", () => {
  it("defines the required fields, in order, for each of the six matrix types", () => {
    expect(TRANSACTION_FIELD_SETS["Halfday"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Undertime"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Others"]).toEqual([
      "plannedDate",
      "plannedTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Out for Lunch"]).toEqual([
      "plannedDate",
      "plannedTime",
      "returnTime",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Routing to other Business Unit"]).toEqual([
      "plannedDate",
      "plannedTime",
      "originBusinessUnit",
      "enrouteBusinessUnits",
      "reason",
    ]);
    expect(TRANSACTION_FIELD_SETS["Visitor Pass"]).toEqual([
      "visitorType",
      "plannedDate",
      "plannedTime",
      "personToMeet",
      "departmentId",
      "reason",
      "visitLocation",
      "transportType",
      "plateNo",
    ]);
  });
});

describe("TRANSACTION_FIELD_LABELS", () => {
  it("has a human-readable label for every field key used across TRANSACTION_FIELD_SETS", () => {
    const allKeys = Object.values(TRANSACTION_FIELD_SETS).flat();
    for (const key of allKeys) {
      expect(typeof TRANSACTION_FIELD_LABELS[key]).toBe("string");
      expect(TRANSACTION_FIELD_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("findMissingRequiredField", () => {
  it("returns the first missing required field for a known matrix type", () => {
    expect(
      findMissingRequiredField("Halfday", { plannedDate: "2026-07-25" })
    ).toBe("plannedTime");
  });

  it("returns null when all required fields are present", () => {
    expect(
      findMissingRequiredField("Halfday", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        reason: "Family errand",
      })
    ).toBeNull();
  });

  it("treats an empty string as missing", () => {
    expect(
      findMissingRequiredField("Halfday", {
        plannedDate: "2026-07-25",
        plannedTime: "",
        reason: "Family errand",
      })
    ).toBe("plannedTime");
  });

  it("treats an empty enrouteBusinessUnits array as missing", () => {
    expect(
      findMissingRequiredField("Routing to other Business Unit", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: [],
        reason: "Delivering documents",
      })
    ).toBe("enrouteBusinessUnits");
  });

  it("accepts a non-empty enrouteBusinessUnits array", () => {
    expect(
      findMissingRequiredField("Routing to other Business Unit", {
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Delta"],
        reason: "Delivering documents",
      })
    ).toBeNull();
  });

  it("returns null (nothing required) for a matrix type with no configured field set", () => {
    expect(findMissingRequiredField("Some Unconfigured Type", {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/transactionFieldSets.test.ts`
Expected: FAIL — `lib/transactionFieldSets.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `lib/transactionFieldSets.ts`:

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
  Halfday: ["plannedDate", "plannedTime", "reason"],
  Undertime: ["plannedDate", "plannedTime", "reason"],
  Others: ["plannedDate", "plannedTime", "reason"],
  "Out for Lunch": ["plannedDate", "plannedTime", "returnTime", "reason"],
  "Routing to other Business Unit": [
    "plannedDate",
    "plannedTime",
    "originBusinessUnit",
    "enrouteBusinessUnits",
    "reason",
  ],
  "Visitor Pass": [
    "visitorType",
    "plannedDate",
    "plannedTime",
    "personToMeet",
    "departmentId",
    "reason",
    "visitLocation",
    "transportType",
    "plateNo",
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

export function findMissingRequiredField(
  matrixTypeName: string,
  values: Partial<Record<TransactionFieldKey, string | string[] | undefined>>
): TransactionFieldKey | null {
  const required = TRANSACTION_FIELD_SETS[matrixTypeName] ?? [];
  for (const key of required) {
    const value = values[key];
    const isEmpty = Array.isArray(value)
      ? value.length === 0
      : !value || value.trim() === "";
    if (isEmpty) return key;
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/transactionFieldSets.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/transactionFieldSets.ts lib/transactionFieldSets.test.ts
git commit -m "Add shared required-field config per matrix type"
```

---

### Task 2: Server-side enforcement in `POST /api/transactions`

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify (tests only): `app/api/transactions/route.test.ts`

**Interfaces:**
- Consumes: `TRANSACTION_FIELD_LABELS`, `findMissingRequiredField` from `lib/transactionFieldSets` (Task 1).
- Produces: no new exports — `POST` now returns `400` with a specific message when a required field is missing for the selected matrix type, checked before any DB write.

- [ ] **Step 1: Add two new matrix-type fixtures and failing tests**

In `app/api/transactions/route.test.ts`, add two new `let` declarations near the top (after `let departmentId: string;`):

```ts
let halfdayMatrixTypeId: string;
let routingMatrixTypeId: string;
```

Inside `beforeAll`, immediately after the existing `matrixTypeId = matrixType.id;` line, add:

```ts
    const halfdayMatrixType = await prisma.matrixType.upsert({
      where: { name: "Halfday" },
      update: {},
      create: {
        matrixCode: "MT-HALFDAYFIXTURE",
        name: "Halfday",
        creatorId: user.id,
      },
    });
    halfdayMatrixTypeId = halfdayMatrixType.id;

    const routingMatrixType = await prisma.matrixType.upsert({
      where: { name: "Routing to other Business Unit" },
      update: {},
      create: {
        matrixCode: "MT-ROUTINGFIXTURE",
        name: "Routing to other Business Unit",
        creatorId: user.id,
      },
    });
    routingMatrixTypeId = routingMatrixType.id;
```

Add these new `it` blocks right before the closing `afterAll` block:

```ts
  it("returns a specific message when a required field is missing for Halfday", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: halfdayMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Reason is required for this transaction type");
  });

  it("creates a transaction when all of Halfday's required fields are provided", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: halfdayMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        reason: "Family errand",
      })
    );
    expect(response.status).toBe(201);
  });

  it("returns a specific message when Enroute to Other Business Unit is missing for Routing to other Business Unit", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: routingMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        reason: "Delivering documents",
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(
      "Enroute to Other Business Unit is required for this transaction type"
    );
  });

  it("creates a transaction when all of Routing to other Business Unit's required fields are provided", async () => {
    const response = await POST(
      requestWithCookie(userToken, {
        matrixTypeId: routingMatrixTypeId,
        plannedDate: "2026-07-25",
        plannedTime: "09:00",
        originBusinessUnit: "Cawit",
        enrouteBusinessUnits: ["Delta"],
        reason: "Delivering documents",
      })
    );
    expect(response.status).toBe(201);
  });

  it("requires nothing beyond the matrix type itself for a type with no configured field set", async () => {
    const response = await POST(requestWithCookie(userToken, { matrixTypeId }));
    expect(response.status).toBe(201);
  });
```

Update the existing `afterAll` block to also clean up transactions created against the two new fixtures (do **not** delete the `matrixType` rows themselves — `"Halfday"` and `"Routing to other Business Unit"` are shared seed data reused via `upsert`, not owned by this test file):

```ts
  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { matrixTypeId } });
    await prisma.transaction.deleteMany({ where: { matrixTypeId: halfdayMatrixTypeId } });
    await prisma.transaction.deleteMany({ where: { matrixTypeId: routingMatrixTypeId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run app/api/transactions/route.test.ts`
Expected: The 4 new "Halfday"/"Routing" tests FAIL (no required-field check exists yet, so missing-field requests currently return `201` instead of `400`). The "requires nothing..." test and all pre-existing tests still PASS (no behavior change for them yet).

- [ ] **Step 3: Implement the server-side check**

Modify `app/api/transactions/route.ts`. Add the import:

```ts
import { TRANSACTION_FIELD_LABELS, findMissingRequiredField } from "@/lib/transactionFieldSets";
```

Insert this block in `POST`, right after the existing `if (!parsed.success) { ... }` block and before the existing `const openStatus = ...` line:

```ts
  const matrixType = await prisma.matrixType.findUnique({
    where: { id: parsed.data.matrixTypeId },
    select: { name: true },
  });
  if (!matrixType) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }

  const missingField = findMissingRequiredField(matrixType.name, parsed.data);
  if (missingField) {
    return NextResponse.json(
      {
        error: `${TRANSACTION_FIELD_LABELS[missingField]} is required for this transaction type`,
      },
      { status: 400 }
    );
  }
```

The rest of the file (the transaction-code retry loop, the `P2002`/`P2003` catch blocks) is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/transactions/route.test.ts`
Expected: PASS, all tests green (existing + the 4 new ones).

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: Only the two known pre-existing `prisma/seed.test.ts` baseline failures (seed-admin drift + reference-data drift, documented in the branch handoff) — no other failures.

- [ ] **Step 6: Commit**

```bash
git add app/api/transactions/route.ts app/api/transactions/route.test.ts
git commit -m "Enforce required fields per matrix type in POST /api/transactions"
```

---

### Task 3: Add Transaction form — dynamic per-type fields

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `TRANSACTION_FIELD_SETS`, `TRANSACTION_FIELD_LABELS`, `findMissingRequiredField`, `TransactionFieldKey` from `lib/transactionFieldSets` (Task 1).
- Produces: no new exports — `TransactionsView`'s public props (`TransactionRow`, `MatrixTypeOption`, `DepartmentOption`) are unchanged.

- [ ] **Step 1: Replace the test file**

Replace the full contents of `app/(authenticated)/transactions/open/TransactionsView.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  { id: "mt4", name: "Routing to other Business Unit" },
  { id: "mt5", name: "Out for Lunch" },
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

function rowFor(code: string) {
  const cell = screen.getByText(code);
  const row = cell.closest("tr");
  if (!row) throw new Error(`No <tr> ancestor found for ${code}`);
  return row;
}

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
}

function selectType(id: string) {
  fireEvent.change(screen.getByLabelText(/transaction type/i), {
    target: { value: id },
  });
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

  it("renders the transactions table with the 6 core columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });

  it("does not show detail fields until a row is expanded", () => {
    renderView();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
    expect(screen.queryByText("Cawit")).not.toBeInTheDocument();
  });

  it("expands a row to reveal its populated detail fields, skipping dash-only ones, and collapses again on second click", () => {
    renderView();
    fireEvent.click(rowFor("OT-001"));

    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument(); // Planned Date
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Delta")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
    // Dash-only fields for this row must not appear in the expanded panel
    expect(screen.queryByText("Visitor Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Person to Meet")).not.toBeInTheDocument();

    fireEvent.click(rowFor("OT-001"));
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });

  it("expanding a Visitor Pass row shows its populated visitor fields and skips its dash-only generic fields", () => {
    render(
      <TransactionsView
        transactions={visitorPassTransactions}
        matrixTypes={matrixTypes}
        currentUserBusinessUnit=""
        departments={departments}
      />
    );
    fireEvent.click(rowFor("OT-002"));

    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Lobby, Room 204")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
    expect(screen.queryByText("Origin Business Unit")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Enroute to Other Business Unit")
    ).not.toBeInTheDocument();
  });

  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });

  it("opens an enlarged QR view when the thumbnail is clicked, and closes it via the X, without expanding the row", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();

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

  it("pressing Enter on the QR thumbnail opens the enlarge dialog, not the row's expand panel", async () => {
    const user = userEvent.setup();
    renderView();
    const qrButton = screen.getByRole("button", {
      name: "QR code for transaction OT-001",
    });
    qrButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });

  it("opens the modal and lists matrix type options", () => {
    renderView();
    openModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Halfday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Undertime" })).toBeInTheDocument();
  });

  it("shows no extra fields until a Transaction Type is selected", () => {
    renderView();
    openModal();
    expect(screen.queryByLabelText(/planned date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^reason$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Halfday's required fields when Halfday is selected", () => {
    renderView();
    openModal();
    selectType("mt1");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Out for Lunch's required fields when selected", () => {
    renderView();
    openModal();
    selectType("mt5");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Routing to other Business Unit's required fields when selected", () => {
    renderView();
    openModal();
    selectType("mt4");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /enroute to other business unit/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows the Visitor Pass field set when Visitor Pass is selected", () => {
    renderView();
    openModal();
    selectType("mt3");

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

  it("switching from Visitor Pass to Halfday swaps the field set", () => {
    renderView();
    openModal();
    selectType("mt3");
    expect(screen.getByLabelText(/^visitor type$/i)).toBeInTheDocument();

    selectType("mt1");
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
  });

  it("shows a specific error and does not submit when a required field is missing", () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("Planned Date is required for this transaction type");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a specific error when Enroute to Other Business Unit has no boxes checked", () => {
    renderView();
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Cawit" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enroute to Other Business Unit is required for this transaction type"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits Halfday's required fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
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
            plannedTime: "09:00",
            reason: "Client meeting",
          }),
        })
      )
    );
  });

  it("submits Out for Lunch's required fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt5");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getByLabelText(/return time/i), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Lunch out" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt5",
            plannedDate: "2026-07-25",
            plannedTime: "12:00",
            returnTime: "13:00",
            reason: "Lunch out",
          }),
        })
      )
    );
  });

  it("submits Routing to other Business Unit's required fields, including checked Enroute boxes", async () => {
    renderView();
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Cawit" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Delta" }));
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt4",
            plannedDate: "2026-07-25",
            plannedTime: "09:00",
            originBusinessUnit: "Cawit",
            enrouteBusinessUnits: ["Alpha", "Delta"],
            reason: "Delivering documents",
          }),
        })
      )
    );
  });

  it("submits populated Visitor Pass fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt3");
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
            visitorType: "Supplier",
            plannedDate: "2026-07-26",
            plannedTime: "10:30",
            personToMeet: "Analyn Gentizon",
            departmentId: "d1",
            reason: "Product demo for a prospective supplier",
            visitLocation: "Lobby, Room 204",
            transportType: "Car",
            plateNo: "ABC-1234",
          }),
        })
      )
    );
  });

  it("pre-fills Origin Business Unit with the current user's business unit when Routing to other Business Unit is selected", () => {
    renderView("Cawit");
    openModal();
    selectType("mt4");
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("Cawit");
  });

  it("still allows changing the pre-filled Origin Business Unit before submitting", async () => {
    renderView("Cawit");
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Delta" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"originBusinessUnit":"Delta"'),
        })
      )
    );
  });

  it("leaves Origin Business Unit unset when the current user's business unit isn't one of the fixed options", () => {
    renderView("MSC");
    openModal();
    selectType("mt4");
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("");
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Client meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/\(authenticated\)/transactions/open/TransactionsView.test.tsx`
Expected: Many failures — the component still has the old two-branch (`isVisitorPass`) rendering, so fields render before a type is selected, Halfday/Out for Lunch/Routing show the wrong field sets, and there's no required-field error handling yet.

- [ ] **Step 3: Replace the component's field-rendering and submit logic**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, add this import alongside the existing ones at the top of the file:

```ts
import {
  TRANSACTION_FIELD_SETS,
  TRANSACTION_FIELD_LABELS,
  findMissingRequiredField,
  type TransactionFieldKey,
} from "@/lib/transactionFieldSets";
```

Replace everything from `export function TransactionsView({` through the end of the file with:

```tsx
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

  const selectedTypeName = matrixTypes.find(
    (option) => option.id === matrixTypeId
  )?.name;
  const activeFields: readonly TransactionFieldKey[] = selectedTypeName
    ? TRANSACTION_FIELD_SETS[selectedTypeName] ?? []
    : [];

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

  function renderField(key: TransactionFieldKey) {
    switch (key) {
      case "plannedDate":
        return (
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
        );
      case "plannedTime":
        return (
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
        );
      case "returnTime":
        return (
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
        );
      case "originBusinessUnit":
        return (
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
        );
      case "enrouteBusinessUnits":
        return (
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
        );
      case "reason":
        return (
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
        );
      case "visitorType":
        return (
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
        );
      case "personToMeet":
        return (
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
        );
      case "departmentId":
        return (
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
        );
      case "visitLocation":
        return (
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
        );
      case "transportType":
        return (
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
        );
      case "plateNo":
        return (
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
        );
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!selectedTypeName) return;

    const fieldValues: Record<TransactionFieldKey, string | string[]> = {
      plannedDate,
      plannedTime,
      returnTime,
      originBusinessUnit,
      enrouteBusinessUnits,
      reason,
      visitorType,
      personToMeet,
      departmentId,
      visitLocation,
      transportType,
      plateNo,
    };

    const missingField = findMissingRequiredField(selectedTypeName, fieldValues);
    if (missingField) {
      setError(
        `${TRANSACTION_FIELD_LABELS[missingField]} is required for this transaction type`
      );
      return;
    }

    setSubmitting(true);

    const body: Record<string, unknown> = { matrixTypeId };
    for (const key of activeFields) {
      body[key] = fieldValues[key];
    }

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

                {activeFields.map((key) => (
                  <Fragment key={key}>{renderField(key)}</Fragment>
                ))}

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

Everything above `export function TransactionsView({` (imports, `TransactionRow`/`MatrixTypeOption`/`DepartmentOption` types, `CloseIcon`, `transactionDetailFields`, `TransactionsTable`, `inputClassName`, `labelClassName`) stays exactly as it already is in the file — only add the one new import at the top and replace the `TransactionsView` function itself.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/\(authenticated\)/transactions/open/TransactionsView.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run`
Expected: Only the two known pre-existing `prisma/seed.test.ts` baseline failures — no other failures.

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Render and require per-matrix-type fields in the Add Transaction form"
```

---

## Post-plan verification (not a task — do after Task 3)

- Live-verify in the dev server: open `/transactions/open`, click "+ Add Transaction", confirm no fields show until a type is picked, confirm each of the 6 matrix types shows exactly its documented field set, confirm submitting with a required field empty shows the specific error and does not create a row, confirm a fully-filled submission succeeds and the new row's expandable detail shows only the fields that type captured.
- Restart the dev server first if any Prisma migration ran earlier in the session (none is expected for this plan, but check per the branch's known stale-Prisma-Client gotcha).
