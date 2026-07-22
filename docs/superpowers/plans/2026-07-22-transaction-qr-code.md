# Transaction QR Code Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QR code column (encoding each transaction's code) to the Open Transaction table, with a click-to-enlarge view.

**Architecture:** Generate the QR code server-side in `page.tsx` using the `qrcode` npm package (never imported by a client component, so it costs nothing in the client bundle), passed down as a data-URL string per row. `TransactionsView`'s existing client table renders it as a thumbnail button that opens a modal reusing the dialog chrome already established in the same file for the Add Transaction modal.

**Tech Stack:** Next.js App Router (Server Component data fetching), `qrcode` npm package, React 19 client-component state, Vitest + Testing Library.

## Global Constraints

- New dependencies required this round: `qrcode`, `@types/qrcode` — install via `npm install qrcode @types/qrcode --ignore-scripts` (this project's standing install convention).
- The QR code encodes `transactionCode` only (e.g. `OT-001`) — no other transaction fields.
- **Display only.** No scan/lookup wiring — that stays blocked on the approval workflow not existing yet (see `docs/superpowers/2026-07-19-green-rebrand-handoff.md` §3w).
- Scope is `app/(authenticated)/transactions/open` only — Approved/Canceled/My Approvals pages are still unbuilt `PagePlaceholder`s and out of scope.
- The enlarge modal closes via the ✕ button **only** — no backdrop-click or Escape-key dismissal, matching this branch's established modal convention (already the de facto behavior of the Add Transaction modal in this same file, and explicitly regression-tested for the Register Users edit modal).
- Neon cold-start: `P1001`/connection errors on DB-backed tests — retry once before concluding breakage.
- `prisma/seed.test.ts` failing its pristine-admin-state assertion is the **expected baseline** (seed admin is user-owned now, see handoff §5) — do NOT reset the seed admin's password/`mustChangePassword`. If you see a *different* failure count, re-run the affected files in isolation before assuming a real regression (known parallel-test-worker races against the shared live DB, handoff §5).

---

### Task 1: Generate the QR code and add the table column

**Files:**
- Modify: `package.json` (add `qrcode`, `@types/qrcode`)
- Modify: `app/(authenticated)/transactions/open/page.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Test: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: nothing new from earlier tasks — this is the first task of this plan.
- Produces: `TransactionRow.qrDataUrl: string` (new field, a `data:image/png;base64,...` URL) — Task 2 renders this value inside a click-to-enlarge modal.

- [ ] **Step 1: Write the failing component tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, update the fixture (add `qrDataUrl` — the type will require it once Task 1 is implemented):

```tsx
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
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
```

Update the existing `"renders the additional fields as table columns before Created By"` test's header assertion to expect a new leading `"QR"` column:

```tsx
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
      "Created By",
      "Status",
      "Date Filed",
    ]);
```

Add a new test immediately after that one:

```tsx
  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — the header-order test fails on the array mismatch (no `"QR"` entry yet), and `"renders a QR code thumbnail for each transaction"` fails because `getByAltText("QR code for transaction OT-001")` finds nothing.

- [ ] **Step 3: Implement the table column**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, update the `TransactionRow` type to add `qrDataUrl` right after `transactionCode`:

```tsx
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
  createdBy: string;
  statusName: string;
  createdAt: string;
};
```

In `TransactionsTable`, add `"QR"` as the first entry of the `columns` array:

```tsx
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
    "Created By",
    "Status",
    "Date Filed",
  ];
```

Add a new `<td>` as the first cell of each row, immediately before the existing `<td className="whitespace-nowrap px-4 py-3">{row.transactionCode}</td>`:

```tsx
                <td className="whitespace-nowrap px-4 py-3">
                  <img
                    src={row.qrDataUrl}
                    alt={`QR code for transaction ${row.transactionCode}`}
                    className="h-12 w-12 rounded border border-slate-200"
                  />
                </td>
```

(This plain `<img>` is an interim, non-interactive rendering — Task 2 wraps it in a clickable button and adds the enlarge modal.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Install the QR code dependency**

Run: `npm install qrcode @types/qrcode --ignore-scripts`
Expected: `package.json`/`package-lock.json` updated, `qrcode` and `@types/qrcode` added under `dependencies`/`devDependencies` respectively.

- [ ] **Step 6: Generate the QR code server-side**

Replace the top of `app/(authenticated)/transactions/open/page.tsx` (imports through the start of `transactionRows`):

```tsx
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { TransactionsView } from "./TransactionsView";

export default async function OpenTransactionsPage() {
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
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
  );
```

The rest of the file (the `return (...)` JSX block) is unchanged.

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: clean build, no type errors (confirms `qrDataUrl` satisfies `TransactionRow` end-to-end from `page.tsx` through `TransactionsView`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json "app/(authenticated)/transactions/open/page.tsx" "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Generate and display a QR code column on the Open Transaction table"
```

---

### Task 2: Click-to-enlarge modal

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Test: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `TransactionRow.qrDataUrl` (Task 1); the existing `CloseIcon` component already defined at the top of `TransactionsView.tsx` (used by the Add Transaction modal).
- Produces: nothing consumed elsewhere in this plan — this is the final task.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, add `within` to the existing Testing Library import:

```tsx
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
```

Add these two tests immediately after `"renders a QR code thumbnail for each transaction"`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — `getByRole("button", { name: "QR code for transaction OT-001" })` finds nothing, since the thumbnail is still a plain `<img>`, not a button.

- [ ] **Step 3: Implement the button and enlarge modal**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, replace the entire `TransactionsTable` function (from `function TransactionsTable({ rows }: { rows: TransactionRow[] }) {` through its closing `}`) with:

```tsx
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
```

Note: the `<img>` keeps the exact same `alt` text it had in Task 1 (unchanged) — the button intentionally has no separate `aria-label`. A `<button>` containing only a labeled image inherits its accessible name from that image's `alt` ("name from content"), so `getByRole("button", { name: "QR code for transaction OT-001" })` and Task 1's existing `getByAltText("QR code for transaction OT-001")` both keep working against the same element without any duplication.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests in the file green (including the two new ones and everything from Task 1).

- [ ] **Step 5: Run the full test suite and build**

Run: `npx vitest run`
Expected: same known baseline as before this plan (only `prisma/seed.test.ts`'s pristine-admin-state assertion fails, per the project's documented seed-admin drift — see Global Constraints above). If you see extra/different failures, re-run the specific files in isolation before concluding there's a regression.

Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Add click-to-enlarge QR code modal to the Open Transaction table"
```

---

## Self-Review Notes

- **Spec coverage:** server-side generation via `qrcode` (§1 of the spec) → Task 1; new leading "QR" column with a keyboard-reachable thumbnail (§2) → Task 1 (static image) completed into a button in Task 2; enlarge modal with ✕-only close (§3) → Task 2; test additions listed in §4 → covered across both tasks' Step 1s. Out-of-scope items (scan/lookup, download/print, other transaction pages, schema changes) are not touched by either task.
- **Type consistency:** `TransactionRow.qrDataUrl: string` (Task 1) is the exact field name read in Task 2 (`row.qrDataUrl`, `enlargedRow.qrDataUrl`). `setEnlargedCode`/`enlargedCode`/`enlargedRow` naming is consistent within Task 2's single code block. `CloseIcon` referenced in Task 2 matches the component already defined earlier in the same file (no redefinition).
- **No placeholders:** every step has complete, runnable code; no TBDs.
