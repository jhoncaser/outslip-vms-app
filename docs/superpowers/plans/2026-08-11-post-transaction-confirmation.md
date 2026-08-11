# Post Transaction Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `window.confirm()` popup shown when posting a transaction with a custom dark-theme confirmation modal, per `docs/superpowers/specs/2026-08-11-post-transaction-confirmation-design.md`.

**Architecture:** A new shared `PostTransactionModal` component (green-themed mirror of the existing `CancelTransactionModal`) replaces the `window.confirm()` call in both the transaction detail page and the Open Transactions list. Unposting keeps its existing no-confirmation behavior unchanged.

**Tech Stack:** Next.js client components, React state, Vitest + Testing Library.

## Global Constraints

- Only the "about to post" path gains a confirmation modal. Unposting fires immediately with no popup, exactly as today — this is not changing.
- The modal follows this branch's established convention: `role="dialog"`, no backdrop-click/Escape dismissal.
- No "cannot be undone" language — posting is reversible (unlike Cancel).
- On a failed post attempt, the modal stays open showing the error (not the old inline text) so the user can retry, mirroring how `CancelTransactionModal` already handles its own errors.
- `CancelTransactionModal` and its own confirmation flow are untouched by this plan.
- No backend changes — this is a pure UI/state change against the already-shipped `PATCH /api/transactions/[id]` endpoint.

---

### Task 1: Shared `PostTransactionModal` component

**Files:**
- Create: `components/dashboard/PostTransactionModal.tsx`
- Test: `components/dashboard/PostTransactionModal.test.tsx`

**Interfaces:**
- Consumes: `buttonPrimary`, `buttonSecondary` from `@/lib/deepForest` (existing).
- Produces: `PostTransactionModal({ transactionCode, matrixTypeName, submitting, error, onCancel, onConfirm })` — a controlled component with no internal state, same prop shape as `CancelTransactionModal`. Tasks 2 and 3 both import and render this from `@/components/dashboard/PostTransactionModal`.

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/PostTransactionModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PostTransactionModal } from "./PostTransactionModal";

describe("PostTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm when Post is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both buttons while submitting and shows Posting…", () => {
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error="Something went wrong"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("does not dismiss on backdrop click or Escape", () => {
    const onCancel = vi.fn();
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/dashboard/PostTransactionModal.test.tsx`
Expected: FAIL — `./PostTransactionModal` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `components/dashboard/PostTransactionModal.tsx`:

```tsx
"use client";

import { buttonPrimary, buttonSecondary } from "@/lib/deepForest";

export function PostTransactionModal({
  transactionCode,
  matrixTypeName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  transactionCode: string;
  matrixTypeName: string;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] p-6 text-center shadow-[0_0_40px_rgba(44,112,1,0.3)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#57e34c]/18 text-xl">
          📮
        </div>
        <h2
          id="post-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Post this transaction?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-4 text-xs text-[#9db894]">
          You won&apos;t be able to add, edit, or delete line items until you unpost it.
        </p>
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`flex-1 ${buttonSecondary} px-4 py-2 text-xs`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-1 ${buttonPrimary} px-4 py-2 text-xs`}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note: the confirm button reuses the shared `buttonPrimary` token (unlike `CancelTransactionModal`'s confirm button, which hardcodes its own red styling because no shared "destructive" button token exists yet) — Post is the app's normal positive/primary action, and `buttonPrimary` is already the green token used for it everywhere else, including the page-level Post/Unpost button. Appending `px-4 py-2 text-xs` after a shared button token to override its size is the established pattern in this codebase — `CancelTransactionModal`'s own Cancel button does the same thing with `buttonSecondary`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/dashboard/PostTransactionModal.test.tsx`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PostTransactionModal.tsx components/dashboard/PostTransactionModal.test.tsx
git commit -m "Add shared PostTransactionModal component"
```

---

### Task 2: Detail page — replace window.confirm with the modal

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: `PostTransactionModal` from Task 1.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, replace the entire `describe("TransactionDetailView — Post/Unpost", ...)` block (currently spanning from `describe("TransactionDetailView — Post/Unpost", () => {` through its closing `});`) with:

```tsx
describe("TransactionDetailView — Post/Unpost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ postedAt: null }) })));
  });

  it("does not render a Post button for a non-owner", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
  });

  it("opens the post-confirmation modal with the transaction code and type", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Visitor Pass")).toBeInTheDocument();
  });

  it("calls the PATCH endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^post$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: true }) })
      )
    );
  });

  it("closes the modal without calling PATCH when Cancel is clicked", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a POSTED badge and hides + Add Line Item and the Actions column once posted, for every viewer", () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("POSTED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });

  it("renders an Unpost button for the owner when posted, and unposts immediately with no confirmation modal", async () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^unpost$/i }));
    expect(screen.queryByRole("dialog", { name: /post this transaction/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: false }) })
      )
    );
  });

  it("shows an error inside the modal when the PATCH request fails, and keeps it open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ error: "Only the creator can post or unpost this transaction" }),
        })
      )
    );
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^post$/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /only the creator can post or unpost this transaction/i
    );
    expect(screen.getByRole("dialog", { name: /post this transaction/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: FAIL — no post-confirmation modal exists yet, clicking Post still tries (and fails, since `window.confirm` isn't mocked in these new tests) to call `window.confirm`.

- [ ] **Step 3: Import the modal**

Add this import alongside the existing `CancelTransactionModal` import at the top of `TransactionDetailView.tsx`:

```tsx
import { PostTransactionModal } from "@/components/dashboard/PostTransactionModal";
```

- [ ] **Step 4: Add the modal-open state and split the click handler**

Change:

```tsx
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState("");

  async function handleTogglePosted() {
    if (!isPosted) {
      const confirmed = window.confirm(
        "Post this transaction? You won't be able to add, edit, or delete line items until you unpost it."
      );
      if (!confirmed) return;
    }

    setPostError("");
    setPostSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: !isPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError(data.error ?? "Something went wrong");
        setPostSubmitting(false);
        return;
      }

      setPostSubmitting(false);
      router.refresh();
    } catch {
      setPostError("An error occurred while updating the transaction");
      setPostSubmitting(false);
    }
  }
```

to:

```tsx
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);

  function handlePostButtonClick() {
    if (isPosted) {
      handleTogglePosted();
    } else {
      setPostError("");
      setShowPostModal(true);
    }
  }

  async function handleTogglePosted() {
    setPostError("");
    setPostSubmitting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: !isPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError(data.error ?? "Something went wrong");
        setPostSubmitting(false);
        return;
      }

      setPostSubmitting(false);
      setShowPostModal(false);
      router.refresh();
    } catch {
      setPostError("An error occurred while updating the transaction");
      setPostSubmitting(false);
    }
  }
```

(`setShowPostModal(false)` on success is a harmless no-op when this ran via the Unpost path, since the modal was never open in that case.)

- [ ] **Step 5: Wire the button's onClick to the new handler**

Change:

```tsx
          {isOwner && !isCancelled && (
            <button
              type="button"
              onClick={handleTogglePosted}
              disabled={postSubmitting}
              className={`${isPosted ? buttonSecondary : buttonPrimary} px-5 py-2 text-xs`}
            >
              {postSubmitting ? "Saving…" : isPosted ? "UNPOST" : "POST"}
            </button>
          )}
```

to:

```tsx
          {isOwner && !isCancelled && (
            <button
              type="button"
              onClick={handlePostButtonClick}
              disabled={postSubmitting}
              className={`${isPosted ? buttonSecondary : buttonPrimary} px-5 py-2 text-xs`}
            >
              {postSubmitting ? "Saving…" : isPosted ? "UNPOST" : "POST"}
            </button>
          )}
```

- [ ] **Step 6: Hide the old inline error while the modal owns it**

Change:

```tsx
      {postError && (
        <p role="alert" className="mb-3 text-xs text-red-400">
          {postError}
        </p>
      )}
```

to:

```tsx
      {postError && !showPostModal && (
        <p role="alert" className="mb-3 text-xs text-red-400">
          {postError}
        </p>
      )}
```

(This inline paragraph still fires for Unpost failures, which never open the modal. While the post-confirmation modal is open, its own error slot shows the message instead — without this guard, both would render simultaneously and any `getByRole("alert")` query would throw a multiple-elements error.)

- [ ] **Step 7: Render the modal**

Change the end of the component from:

```tsx
      {showCancelModal && (
        <CancelTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
```

to:

```tsx
      {showCancelModal && (
        <CancelTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {showPostModal && (
        <PostTransactionModal
          transactionCode={transaction.transactionCode}
          matrixTypeName={transaction.matrixTypeName}
          submitting={postSubmitting}
          error={postError}
          onCancel={() => setShowPostModal(false)}
          onConfirm={handleTogglePosted}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests.

- [ ] **Step 9: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing baseline as always (the two known `prisma/seed.test.ts` failures — seed-admin drift and reference-data drift), nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 10: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"
git commit -m "Replace window.confirm with PostTransactionModal on the detail page"
```

---

### Task 3: List page — replace window.confirm with the modal

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: `PostTransactionModal` from Task 1.
- Produces: nothing new for later tasks — this is the last task.

- [ ] **Step 1: Write the failing tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`, replace the entire `describe("TransactionsView — Post/Unpost", ...)` block with:

```tsx
describe("TransactionsView — Post/Unpost", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ postedAt: null }) }))
    );
  });

  it("shows a Post button when the current user created the transaction and it isn't posted", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    expect(
      within(rowFor("OT-001")).getByRole("button", { name: /^post$/i })
    ).toBeInTheDocument();
  });

  it("shows a dash instead of a button when the current user didn't create the transaction", () => {
    renderView("", [{ ...transactions[0], canManagePosting: false, postedAt: null }]);
    expect(
      within(rowFor("OT-001")).queryByRole("button", { name: /^post$|^unpost$/i })
    ).not.toBeInTheDocument();
    expect(within(rowFor("OT-001")).getByText("—")).toBeInTheDocument();
  });

  it("shows an Unpost button and a POSTED badge when already posted", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    const row = rowFor("OT-001");
    expect(within(row).getByRole("button", { name: /^unpost$/i })).toBeInTheDocument();
    expect(within(row).getByText("POSTED")).toBeInTheDocument();
  });

  it("opens the post-confirmation modal and does not navigate the row", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^post$/i }));
    expect(screen.getByRole("dialog", { name: /post this transaction/i })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("unposting fires immediately with no confirmation modal", () => {
    renderView("", [
      { ...transactions[0], canManagePosting: true, postedAt: "2026-08-08T00:00:00.000Z" },
    ]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^unpost$/i }));
    expect(screen.queryByRole("dialog", { name: /post this transaction/i })).not.toBeInTheDocument();
  });

  it("calls the PATCH endpoint with the transaction id and posted flag on confirm", async () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^post$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: true }) })
      )
    );
  });

  it("closes the modal without calling PATCH when Cancel is clicked", () => {
    renderView("", [{ ...transactions[0], canManagePosting: true, postedAt: null }]);
    fireEvent.click(within(rowFor("OT-001")).getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /post this transaction/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: FAIL — no post-confirmation modal exists yet in this file.

- [ ] **Step 3: Import the modal and add state**

Add this import alongside the existing `CancelTransactionModal` import at the top of the file:

```tsx
import { PostTransactionModal } from "@/components/dashboard/PostTransactionModal";
```

Change:

```tsx
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<{ id: string; message: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
```

to:

```tsx
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<{ id: string; message: string } | null>(null);
  const [postModalTarget, setPostModalTarget] = useState<TransactionRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
```

- [ ] **Step 4: Split the toggle handler and add the click-router**

Change:

```tsx
  async function handleTogglePosted(row: TransactionRow) {
    const nextPosted = row.postedAt === null;
    if (nextPosted) {
      const confirmed = window.confirm(
        "Post this transaction? You won't be able to add, edit, or delete line items until you unpost it."
      );
      if (!confirmed) return;
    }

    setPostError(null);
    setPostingId(row.id);
    try {
      const response = await fetch(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: nextPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError({ id: row.id, message: data.error ?? "Something went wrong" });
        setPostingId(null);
        return;
      }

      setPostingId(null);
      router.refresh();
    } catch {
      setPostError({ id: row.id, message: "An error occurred while updating the transaction" });
      setPostingId(null);
    }
  }
```

to:

```tsx
  function handlePostButtonClick(row: TransactionRow) {
    if (row.postedAt) {
      handleTogglePosted(row);
    } else {
      setPostError(null);
      setPostModalTarget(row);
    }
  }

  async function handleTogglePosted(row: TransactionRow) {
    const nextPosted = row.postedAt === null;
    setPostError(null);
    setPostingId(row.id);
    try {
      const response = await fetch(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: nextPosted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPostError({ id: row.id, message: data.error ?? "Something went wrong" });
        setPostingId(null);
        return;
      }

      setPostingId(null);
      setPostModalTarget(null);
      router.refresh();
    } catch {
      setPostError({ id: row.id, message: "An error occurred while updating the transaction" });
      setPostingId(null);
    }
  }

  async function handleConfirmPost() {
    if (!postModalTarget) return;
    await handleTogglePosted(postModalTarget);
  }
```

- [ ] **Step 5: Wire the row button's onClick to the new handler, and scope the inline error to when the modal isn't targeting that row**

Change:

```tsx
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleTogglePosted(row);
                            }}
                            disabled={postingId === row.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none disabled:opacity-60"
                          >
                            {postingId === row.id ? "Saving…" : row.postedAt ? "Unpost" : "Post"}
                          </button>
```

to:

```tsx
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePostButtonClick(row);
                            }}
                            disabled={postingId === row.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none disabled:opacity-60"
                          >
                            {postingId === row.id ? "Saving…" : row.postedAt ? "Unpost" : "Post"}
                          </button>
```

Then change:

```tsx
                      {postError?.id === row.id && (
                        <p role="alert" className="mt-1 text-[10px] text-red-400">
                          {postError.message}
                        </p>
                      )}
```

to:

```tsx
                      {postError?.id === row.id && postModalTarget?.id !== row.id && (
                        <p role="alert" className="mt-1 text-[10px] text-red-400">
                          {postError.message}
                        </p>
                      )}
```

(Same reasoning as the detail page: while the post-confirmation modal is open for this row, its own error slot owns the message. This inline paragraph still fires for Unpost failures, which never open the modal.)

- [ ] **Step 6: Render the modal**

Change:

```tsx
      {cancelTarget && (
        <CancelTransactionModal
          transactionCode={cancelTarget.transactionCode}
          matrixTypeName={cancelTarget.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </>
  );
```

to:

```tsx
      {cancelTarget && (
        <CancelTransactionModal
          transactionCode={cancelTarget.transactionCode}
          matrixTypeName={cancelTarget.matrixTypeName}
          submitting={cancelSubmitting}
          error={cancelError}
          onCancel={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {postModalTarget && (
        <PostTransactionModal
          transactionCode={postModalTarget.transactionCode}
          matrixTypeName={postModalTarget.matrixTypeName}
          submitting={postingId === postModalTarget.id}
          error={postError?.id === postModalTarget.id ? postError.message : ""}
          onCancel={() => setPostModalTarget(null)}
          onConfirm={handleConfirmPost}
        />
      )}
    </>
  );
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests.

- [ ] **Step 8: Run the full suite and build**

Run: `npx vitest run`
Expected: same pre-existing baseline as always (the two known `prisma/seed.test.ts` failures), nothing else new.
Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 9: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Replace window.confirm with PostTransactionModal on the Open Transactions list"
```

## Post-plan verification (controller, not a subagent)

After Task 3 is reviewed and committed, live-verify against the running dev server:

1. From the Open Transactions list, click Post on an unposted transaction you own — confirm the new dark green modal appears with the correct code/type, Cancel closes it with no request sent, Post fires the request and the row updates.
2. From the same list, click Unpost on a posted transaction you own — confirm it unposts immediately with no popup at all (native or custom).
3. Repeat both from the transaction detail page.
4. Force a failure (e.g. via dev tools network throttling/blocking, or briefly stopping the dev server mid-request) to confirm the error renders inside the modal and the modal stays open for a retry, on at least one of the two pages.
