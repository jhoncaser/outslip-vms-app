# Register Users Table + Modal Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/register` into a users table (7 display columns) with a "+ Register User" button that opens the existing 3-step wizard in a modal.

**Architecture:** The server component `page.tsx` (already session-gated on `canProvisionUsers`) fetches all users via Prisma with related names, pre-formats dates server-side, and passes flat rows to a new client component `UsersView` that renders the header/button/table and owns the modal state. The wizard is reused unchanged except its success navigation becomes `router.refresh()` so the table updates. `ROLES`/`ROLE_LABELS` move to `lib/roles.ts` so the wizard dropdown and table pills share one source.

**Tech Stack:** Next.js 16 App Router (this repo's fork — read `node_modules/next/dist/docs/` if unsure), Prisma 6 (Neon Postgres), Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-20-register-users-table-design.md`

## Global Constraints

- No new dependencies. If an install is ever needed: `npm install --ignore-scripts` only.
- Neon cold-start: `P1001`/connection errors on DB-backed tests — retry once before concluding breakage.
- `prisma/seed.test.ts` failing 1 test is the **expected baseline** (seed admin is user-owned now) — do NOT reset the seed admin's password/`mustChangePassword`.
- Brand green is `#2C7001`; page background `#eef1ee`; row-tint `#fbfdf9`.
- Wizard behavior, labels, and copy are unchanged except the one `router.push` → `router.refresh()` swap.
- A dev server may already be running on port 3000 — never start a second one.

---

### Task 1: Shared role constants + wizard success refresh

**Files:**
- Create: `lib/roles.ts`
- Modify: `app/(authenticated)/register/RegistrationWizard.tsx`
- Test: `app/(authenticated)/register/RegistrationWizard.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `lib/roles.ts` exporting `ROLES: readonly ["CREATOR","FIRST_APPROVER","SECOND_APPROVER","THIRD_APPROVER","GUARD_PERSONNEL"]`, `type RoleValue = (typeof ROLES)[number]`, and `ROLE_LABELS: Record<RoleValue, string>`. Task 2 imports `ROLE_LABELS` and `RoleValue` from `@/lib/roles`. Wizard success now calls `router.refresh()`.

- [ ] **Step 1: Update the wizard test to expect `router.refresh()`**

In `app/(authenticated)/register/RegistrationWizard.test.tsx`:

Replace lines 5–9:

```tsx
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
```

with:

```tsx
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
```

Replace `pushMock.mockReset();` in `beforeEach` with `refreshMock.mockReset();`.

Replace the success assertion

```tsx
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/register?success=1"));
```

with:

```tsx
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(authenticated)/register/RegistrationWizard.test.tsx"`
Expected: FAIL — "walks through all 3 steps and submits" times out / `refreshMock` never called (component still calls `router.push`, which is now undefined on the mock — the component may also throw `push is not a function`; either failure mode is the expected red).

- [ ] **Step 3: Create `lib/roles.ts`**

```ts
export const ROLES = [
  "CREATOR",
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
  "GUARD_PERSONNEL",
] as const;

export type RoleValue = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleValue, string> = {
  CREATOR: "Creator",
  FIRST_APPROVER: "1st Level Approver",
  SECOND_APPROVER: "2nd Level Approver",
  THIRD_APPROVER: "3rd Level Approver",
  GUARD_PERSONNEL: "Guard Personnel",
};
```

- [ ] **Step 4: Point the wizard at `lib/roles.ts` and swap push → refresh**

In `app/(authenticated)/register/RegistrationWizard.tsx`:

1. Delete the local `ROLES` array and `ROLE_LABELS` record (lines 15–29) and add to the imports:

```tsx
import { ROLES, ROLE_LABELS, type RoleValue } from "@/lib/roles";
```

2. In `type FormState`, change the role field to use the shared type:

```tsx
  role: RoleValue | "";
```

3. In `submit()`, replace

```tsx
      setSuccess(true);
      router.push("/register?success=1");
```

with:

```tsx
      setSuccess(true);
      router.refresh();
```

Nothing else changes — steps, validation gating, success screen, labels all stay byte-identical.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "app/(authenticated)/register/RegistrationWizard.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/roles.ts "app/(authenticated)/register/RegistrationWizard.tsx" "app/(authenticated)/register/RegistrationWizard.test.tsx"
git commit -m "Extract shared role constants and refresh on registration success

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: UsersView table + modal, page rewire

**Files:**
- Create: `app/(authenticated)/register/UsersView.tsx`
- Create: `app/(authenticated)/register/UsersView.test.tsx`
- Modify: `app/(authenticated)/register/page.tsx` (full rewrite of the returned JSX + data fetch)

**Interfaces:**
- Consumes: `ROLE_LABELS`, `type RoleValue` from `@/lib/roles` (Task 1); `RegistrationWizard` from `./RegistrationWizard`; `prisma` from `@/lib/prisma`.
- Produces: `UsersView({ users }: { users: UserRow[] })` and `export type UserRow = { id: string; firstName: string; lastName: string; role: RoleValue; department: string; businessUnit: string; location: string; createdAt: string }`.

- [ ] **Step 1: Write the failing test**

Create `app/(authenticated)/register/UsersView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UsersView, type UserRow } from "./UsersView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleUsers: UserRow[] = [
  {
    id: "u1",
    firstName: "Juan",
    lastName: "Dela Cruz",
    role: "CREATOR",
    department: "ICT",
    businessUnit: "Cawit",
    location: "Zamboanga",
    createdAt: "Jul 18, 2026",
  },
  {
    id: "u2",
    firstName: "Maria",
    lastName: "Santos",
    role: "FIRST_APPROVER",
    department: "Admin",
    businessUnit: "Corporate",
    location: "Navotas",
    createdAt: "Jul 19, 2026",
  },
];

describe("UsersView", () => {
  beforeEach(() => {
    // The wizard inside the modal fetches reference data on mount.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              departments: [],
              businessUnits: [],
              locations: [],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("renders all seven column headers", () => {
    render(<UsersView users={sampleUsers} />);
    for (const header of [
      "First Name",
      "Last Name",
      "Role",
      "Department",
      "Business Unit",
      "Location",
      "Created",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header })
      ).toBeInTheDocument();
    }
  });

  it("renders user rows with role labels, details, and count", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("1st Level Approver")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Jul 18, 2026")).toBeInTheDocument();
    expect(screen.getByText("2 users")).toBeInTheDocument();
  });

  it("shows the empty state when there are no users", () => {
    render(<UsersView users={[]} />);
    expect(
      screen.getByText(/no users registered yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText("0 users")).toBeInTheDocument();
  });

  it("opens the registration modal and closes it via the Close button", async () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /\+ register user/i })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByText(/select your role/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(authenticated)/register/UsersView.test.tsx"`
Expected: FAIL — cannot resolve `./UsersView` (module does not exist).

- [ ] **Step 3: Create `UsersView.tsx`**

Create `app/(authenticated)/register/UsersView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RegistrationWizard } from "./RegistrationWizard";
import { ROLE_LABELS, type RoleValue } from "@/lib/roles";

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: RoleValue;
  department: string;
  businessUnit: string;
  location: string;
  createdAt: string;
};

const ROLE_PILL_CLASSES: Record<RoleValue, string> = {
  CREATOR: "bg-sky-100 text-sky-800",
  FIRST_APPROVER: "bg-amber-100 text-amber-800",
  SECOND_APPROVER: "bg-green-100 text-green-800",
  THIRD_APPROVER: "bg-indigo-100 text-indigo-800",
  GUARD_PERSONNEL: "bg-purple-100 text-purple-800",
};

const COLUMNS = [
  "First Name",
  "Last Name",
  "Role",
  "Department",
  "Business Unit",
  "Location",
  "Created",
];

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

export function UsersView({ users }: { users: UserRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Registered Users
          </h1>
          <p className="text-xs text-slate-500">
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Register User
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="border-b-2 border-[#2C7001] bg-[#f8faf7]">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-xs font-semibold text-[#3f6212]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No users registered yet.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-100 ${
                    index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3">{user.firstName}</td>
                  <td className="px-4 py-3">{user.lastName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_PILL_CLASSES[user.role]}`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{user.department}</td>
                  <td className="px-4 py-3">{user.businessUnit}</td>
                  <td className="px-4 py-3">{user.location}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {user.createdAt}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-user-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 p-6"
        >
          <div className="mx-auto mt-6 w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl">
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
                id="register-user-title"
                className="text-lg font-extrabold tracking-widest text-white"
              >
                REGISTER USER
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="px-8 py-7">
              <RegistrationWizard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- The modal card header is the same green-gradient block that `page.tsx` renders today — it moves here (as `h2`; the page-level `h1` is now "Registered Users").
- Backdrop clicks and Escape deliberately do NOT close the modal (spec: protects a half-completed wizard). Only the ✕ button closes it.
- The wizard unmounts on close, so reopening always starts fresh at step 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(authenticated)/register/UsersView.test.tsx"`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `page.tsx`**

Replace the entire contents of `app/(authenticated)/register/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { UsersView, type UserRow } from "./UsersView";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canProvisionUsers(session)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      department: { select: { name: true } },
      businessUnit: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  // Dates are formatted here, server-side, so the client never re-formats
  // them in a different timezone (hydration-safe display strings).
  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    department: user.department.name,
    businessUnit: user.businessUnit.name,
    location: user.location.name,
    createdAt: user.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <UsersView users={rows} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Full suite + build**

Run: `npx vitest run`
Expected: all tests pass EXCEPT the known 1-test baseline failure in `prisma/seed.test.ts` (seed admin is user-owned; do not reset it). If a Neon `P1001`/connection flake appears, retry once.

Run: `npm run build`
Expected: clean build, `/register` compiles as a dynamic (server) route.
If the build errors over `.next` being locked by the running dev server, do NOT
kill the dev server — skip the build step and report that it was skipped and why.

- [ ] **Step 7: Commit**

```bash
git add "app/(authenticated)/register/UsersView.tsx" "app/(authenticated)/register/UsersView.test.tsx" "app/(authenticated)/register/page.tsx"
git commit -m "Show registered users table with modal registration wizard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
