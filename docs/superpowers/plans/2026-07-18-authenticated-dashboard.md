# Authenticated Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `/dashboard` placeholder with a shared authenticated navbar+sidebar shell (navy/white, per-account dark/light theme) that wraps the dashboard's 4-tile module grid, the existing registration wizard, and 6 new placeholder pages (Profile, Settings, 4 transaction views).

**Architecture:** A new Next.js route group `app/(authenticated)/` provides one `layout.tsx` (server component) that re-verifies the session, looks up the caller's theme preference, and renders `Navbar` + `Sidebar` around whatever page is active. Existing `app/dashboard` and `app/register` move into the group (URLs unchanged). Theme state lives in a small client-side React Context (`ThemeShell`), seeded server-side to avoid a flash, and persisted per-account via a new `PATCH /api/user/theme` route.

**Tech Stack:** Next.js 16.2.10 (App Router), TypeScript, Prisma 6.19.2 / Postgres (Neon), Tailwind CSS v4, Zod, Vitest 4 + React Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-authenticated-dashboard-design.md` — this plan implements it in full; the real Transaction data model stays out of scope.
- Brand color: navy `#0b2545`. Navbar and Sidebar stay this color in both light and dark mode — only the main content area (module grid, placeholder pages) switches background between white and dark slate.
- `@` import alias resolves to the project root (see `vitest.config.ts` / `tsconfig.json`).
- API route tests that don't render React use `// @vitest-environment node` at the top of the file (matches `app/api/register/route.test.ts`, `app/api/auth/change-password/route.ts` conventions) — faster and avoids jsdom/jose realm issues.
- Zod schemas are the single source of truth for request validation (matches `lib/validation/auth.ts`, `lib/validation/registration.ts`).
- `npm install` scripts are restricted on this machine — use `npm install --ignore-scripts`, then `npx prisma generate` manually, if any task needs a fresh install (none of these tasks add new npm packages, so this should not come up).
- All new files use the existing session/permission helpers unchanged: `verifySessionToken`, `SESSION_COOKIE_NAME` from `lib/auth/session.ts`; `canProvisionUsers` from `lib/auth/permissions.ts`. Do not duplicate this logic.
- Run `npx vitest run` (not just the changed file) before each commit that could plausibly affect other suites, per this project's existing convention of catching cross-file regressions early.

---

### Task 1: Add per-account theme preference to the schema

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/<timestamp>_add_theme_preference/` (generated)

**Interfaces:**
- Produces: `Theme` enum (`"LIGHT" | "DARK"`) and `User.themePreference: Theme` (default `LIGHT`), consumed by Task 3's route and Task 9's layout.

- [ ] **Step 1: Add the enum and field**

In `prisma/schema.prisma`, add the enum near the existing `Role` enum, and add the field to `User`:

```prisma
enum Theme {
  LIGHT
  DARK
}
```

Add this line inside `model User { ... }`, directly under `mustChangePassword`:

```prisma
  themePreference    Theme    @default(LIGHT)
```

The full `User` model block should read:

```prisma
model User {
  id                 String   @id @default(cuid())
  firstName          String
  middleName         String?
  lastName           String
  email              String   @unique
  passwordHash       String
  role               Role
  mustChangePassword Boolean  @default(true)
  themePreference    Theme    @default(LIGHT)
  createdAt          DateTime @default(now())

  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String

  businessUnit   BusinessUnit @relation(fields: [businessUnitId], references: [id])
  businessUnitId String

  location   Location @relation(fields: [locationId], references: [id])
  locationId String
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_theme_preference`
Expected: Prisma reports the migration applied successfully and regenerates the client. This is an additive change (new enum, new column with a default) — existing rows get `LIGHT` automatically, nothing else is affected.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add per-account theme preference to User model"
```

---

### Task 2: Enable Tailwind's class-based dark mode variant

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: a `dark:` utility variant that activates based on a `.dark` class on an ancestor element (not just OS preference), consumed by every component in Tasks 4-8 that uses `dark:` classes.

- [ ] **Step 1: Add the custom variant**

In `app/globals.css`, add this line directly after the `@import "tailwindcss";` line at the top:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

Leave the rest of the file (the `:root` variables, the `@theme inline` block, and the `@media (prefers-color-scheme: dark)` block) unchanged — those still govern the root page background outside the authenticated shell (login, registration, change-password), which keeps its fixed navy/white styling per the spec.

- [ ] **Step 2: Verify the dev server still starts cleanly**

Run: `npm run build`
Expected: build completes with no CSS/Tailwind errors. (No visual change yet — nothing uses `dark:` classes until later tasks.)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Enable Tailwind class-based dark mode variant"
```

---

### Task 3: Theme preference API route

**Files:**
- Create: `lib/validation/theme.ts`
- Create: `app/api/user/theme/route.ts`
- Test: `app/api/user/theme/route.test.ts`

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE_NAME` (`lib/auth/session.ts`); `prisma` (`lib/prisma.ts`); `createSessionToken` (test only, to mint a session cookie).
- Produces: `themeSchema: ZodSchema<{ theme: "LIGHT" | "DARK" }>`; `PATCH` handler at `/api/user/theme` returning `{ themePreference: "LIGHT" | "DARK" }` on success. Consumed by Task 4's `ThemeToggle`.

- [ ] **Step 1: Create the Zod schema**

```typescript
// lib/validation/theme.ts
import { z } from "zod";

export const themeSchema = z.object({
  theme: z.enum(["LIGHT", "DARK"]),
});
```

- [ ] **Step 2: Write the failing route test**

```typescript
// app/api/user/theme/route.test.ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let sessionToken: string;
let userId: string;
const testEmail = "theme-route-test@example.com";

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/user/theme", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("PATCH /api/user/theme", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
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

    const user = await prisma.user.create({
      data: {
        firstName: "Theme",
        lastName: "Tester",
        email: testEmail,
        passwordHash: "not-a-real-hash",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
      },
    });
    userId = user.id;

    sessionToken = await createSessionToken({
      sub: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: "ICT",
      mustChangePassword: false,
    });
  });

  it("returns 401 with no session", async () => {
    const response = await PATCH(
      requestWithCookie(undefined, { theme: "DARK" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid theme value", async () => {
    const response = await PATCH(
      requestWithCookie(sessionToken, { theme: "PURPLE" })
    );
    expect(response.status).toBe(400);
  });

  it("updates the caller's own themePreference and returns it", async () => {
    const response = await PATCH(
      requestWithCookie(sessionToken, { theme: "DARK" })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.themePreference).toBe("DARK");

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(updated.themePreference).toBe("DARK");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run app/api/user/theme/route.test.ts`
Expected: FAIL — `route.ts` does not exist yet (`Cannot find module './route'` or similar).

- [ ] **Step 4: Implement the route**

```typescript
// app/api/user/theme/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { themeSchema } from "@/lib/validation/theme";

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = themeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid theme value" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.sub },
    data: { themePreference: parsed.data.theme },
    select: { themePreference: true },
  });

  return NextResponse.json({ themePreference: updated.themePreference });
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx vitest run app/api/user/theme/route.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/theme.ts app/api/user/theme
git commit -m "Add PATCH /api/user/theme route for per-account theme persistence"
```

---

### Task 4: Theme context, toggle button, and navbar

**Files:**
- Create: `components/dashboard/ThemeShell.tsx`
- Create: `components/dashboard/ThemeToggle.tsx`
- Create: `components/dashboard/Navbar.tsx`
- Test: `components/dashboard/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: nothing external (pure client-side state + `fetch("/api/user/theme")` from Task 3).
- Produces: `ThemeShell({ initialTheme: "LIGHT" | "DARK", children })` (wraps content in a `dark`-class div); `useTheme(): { theme, setTheme }` (consumed by `ThemeToggle` and, indirectly, by anything else needing the live value); `Navbar()`. Consumed by Task 9's layout.

- [ ] **Step 1: Create the theme context/provider**

```tsx
// components/dashboard/ThemeShell.tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Theme = "LIGHT" | "DARK";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeShell");
  }
  return context;
}

export function ThemeShell({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={theme === "DARK" ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Write the failing ThemeToggle test**

```tsx
// components/dashboard/ThemeToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeShell } from "./ThemeShell";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("flips visually right away and persists via PATCH /api/user/theme", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ themePreference: "DARK" }),
    });

    render(
      <ThemeShell initialTheme="LIGHT">
        <ThemeToggle />
      </ThemeShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(
      screen.getByRole("button", { name: /dark/i })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/user/theme",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ theme: "DARK" }),
        })
      )
    );
  });

  it("keeps the flipped visual state even when the persist call fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error")
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ThemeShell initialTheme="LIGHT">
        <ThemeToggle />
      </ThemeShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(
      screen.getByRole("button", { name: /dark/i })
    ).toBeInTheDocument();
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    consoleErrorSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run components/dashboard/ThemeToggle.test.tsx`
Expected: FAIL — `ThemeToggle.tsx` does not exist yet.

- [ ] **Step 4: Implement ThemeToggle**

```tsx
// components/dashboard/ThemeToggle.tsx
"use client";

import { useTheme } from "./ThemeShell";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  async function toggle() {
    const next = theme === "DARK" ? "LIGHT" : "DARK";
    setTheme(next);

    try {
      const response = await fetch("/api/user/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!response.ok) {
        console.error("Failed to save theme preference:", response.status);
      }
    } catch (err) {
      console.error("Failed to save theme preference:", err);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-white/40 px-3 py-1 text-xs text-white"
    >
      {theme === "DARK" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx vitest run components/dashboard/ThemeToggle.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Create the Navbar**

```tsx
// components/dashboard/Navbar.tsx
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="flex items-center justify-between bg-[#0b2545] px-6 py-3 text-white">
      <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
        <span aria-hidden>⛨</span>
        OUTSLIP VMS
      </div>
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/ThemeShell.tsx components/dashboard/ThemeToggle.tsx components/dashboard/ThemeToggle.test.tsx components/dashboard/Navbar.tsx
git commit -m "Add theme context, toggle button, and navbar"
```

---

### Task 5: Sidebar with permission-gated Register User link

**Files:**
- Create: `components/dashboard/Sidebar.tsx`
- Test: `components/dashboard/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nothing external — takes `canProvisionUsers: boolean` as a prop (computed by the caller using the existing `lib/auth/permissions.ts` helper; this component does not import that helper itself).
- Produces: `Sidebar({ canProvisionUsers: boolean })`. Consumed by Task 9's layout.

- [ ] **Step 1: Write the failing test**

```tsx
// components/dashboard/Sidebar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("always shows Dashboard, Profile, Settings, and Logout", () => {
    render(<Sidebar canProvisionUsers={false} />);
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /profile/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /logout/i })
    ).toBeInTheDocument();
  });

  it("hides Register User when canProvisionUsers is false", () => {
    render(<Sidebar canProvisionUsers={false} />);
    expect(
      screen.queryByRole("link", { name: /register user/i })
    ).not.toBeInTheDocument();
  });

  it("shows Register User when canProvisionUsers is true", () => {
    render(<Sidebar canProvisionUsers={true} />);
    expect(
      screen.getByRole("link", { name: /register user/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run components/dashboard/Sidebar.test.tsx`
Expected: FAIL — `Sidebar.tsx` does not exist yet.

- [ ] **Step 3: Implement Sidebar**

```tsx
// components/dashboard/Sidebar.tsx
import Link from "next/link";

export function Sidebar({
  canProvisionUsers,
}: {
  canProvisionUsers: boolean;
}) {
  return (
    <nav className="flex w-48 flex-shrink-0 flex-col gap-1 bg-[#0b2545] p-4 text-sm text-white">
      <Link href="/dashboard" className="rounded px-3 py-2 hover:bg-white/10">
        Dashboard
      </Link>
      <Link href="/profile" className="rounded px-3 py-2 hover:bg-white/10">
        Profile
      </Link>
      <Link href="/settings" className="rounded px-3 py-2 hover:bg-white/10">
        Settings
      </Link>
      {canProvisionUsers && (
        <Link
          href="/register"
          className="rounded px-3 py-2 hover:bg-white/10"
        >
          Register User
        </Link>
      )}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="w-full rounded px-3 py-2 text-left hover:bg-white/10"
        >
          Logout
        </button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run components/dashboard/Sidebar.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Sidebar.tsx components/dashboard/Sidebar.test.tsx
git commit -m "Add authenticated sidebar with permission-gated Register User link"
```

---

### Task 6: Shared placeholder component + 6 placeholder pages

**Files:**
- Create: `components/PagePlaceholder.tsx`
- Create: `app/(authenticated)/profile/page.tsx`
- Create: `app/(authenticated)/settings/page.tsx`
- Create: `app/(authenticated)/transactions/open/page.tsx`
- Create: `app/(authenticated)/transactions/approved/page.tsx`
- Create: `app/(authenticated)/transactions/canceled/page.tsx`
- Create: `app/(authenticated)/transactions/my-approvals/page.tsx`

**Interfaces:**
- Produces: `PagePlaceholder({ title: string, description: string })`, a `flex-1` block meant to sit directly inside the layout's `<main>` (Task 9).

No new logic here (static content, matches this project's existing convention of not unit-testing purely presentational stub pages — see `app/dashboard/page.tsx` prior to this plan, which had no test file). Verified visually in Task 10's manual walkthrough.

- [ ] **Step 1: Create the shared placeholder component**

```tsx
// components/PagePlaceholder.tsx
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="text-xl font-bold text-[#0b2545] dark:text-white">
        {title}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the Profile and Settings pages**

```tsx
// app/(authenticated)/profile/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Profile"
      description="Profile details are coming in a later update."
    />
  );
}
```

```tsx
// app/(authenticated)/settings/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Settings are coming in a later update."
    />
  );
}
```

- [ ] **Step 3: Create the 4 transaction placeholder pages**

```tsx
// app/(authenticated)/transactions/open/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function OpenTransactionsPage() {
  return (
    <PagePlaceholder
      title="Open Transaction"
      description="The open transaction list is coming in a later update."
    />
  );
}
```

```tsx
// app/(authenticated)/transactions/approved/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function ApprovedTransactionsPage() {
  return (
    <PagePlaceholder
      title="Approved Transaction"
      description="The approved transaction list is coming in a later update."
    />
  );
}
```

```tsx
// app/(authenticated)/transactions/canceled/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function CanceledTransactionsPage() {
  return (
    <PagePlaceholder
      title="Canceled Transaction"
      description="The canceled transaction list is coming in a later update."
    />
  );
}
```

```tsx
// app/(authenticated)/transactions/my-approvals/page.tsx
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function MyApprovalsPage() {
  return (
    <PagePlaceholder
      title="My Approvals"
      description="Your pending approvals are coming in a later update."
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/PagePlaceholder.tsx "app/(authenticated)/profile" "app/(authenticated)/settings" "app/(authenticated)/transactions"
git commit -m "Add shared PagePlaceholder and 6 placeholder pages"
```

---

### Task 7: Module grid + move the dashboard page

**Files:**
- Create: `components/dashboard/ModuleGrid.tsx`
- Move: `app/dashboard/page.tsx` &rarr; `app/(authenticated)/dashboard/page.tsx` (content replaced)

**Interfaces:**
- Produces: `ModuleGrid()` — 4 linked tiles to the Task 6 transaction placeholder routes. Consumed directly by the new `app/(authenticated)/dashboard/page.tsx`.

- [ ] **Step 1: Create the module grid**

```tsx
// components/dashboard/ModuleGrid.tsx
import Link from "next/link";

const MODULES = [
  { label: "Open Transaction", href: "/transactions/open" },
  { label: "Approved Transaction", href: "/transactions/approved" },
  { label: "Canceled Transaction", href: "/transactions/canceled" },
  { label: "My Approvals", href: "/transactions/my-approvals" },
];

export function ModuleGrid() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 content-start sm:grid-cols-2">
      {MODULES.map((module) => (
        <Link
          key={module.href}
          href={module.href}
          className="rounded border border-l-4 border-slate-200 border-l-[#0b2545] bg-white p-4 shadow-sm hover:shadow-md dark:border-slate-700 dark:border-l-[#0b2545] dark:bg-slate-800"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {module.label}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0b2545] dark:text-white">
            —
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Move the dashboard page into the route group**

```bash
mkdir -p "app/(authenticated)/dashboard"
git mv app/dashboard/page.tsx "app/(authenticated)/dashboard/page.tsx"
```

- [ ] **Step 3: Replace its content**

Overwrite `app/(authenticated)/dashboard/page.tsx` (the session check and "logged in as" display move to the shared layout in Task 9 — this page is now just the module grid):

```tsx
// app/(authenticated)/dashboard/page.tsx
import { ModuleGrid } from "@/components/dashboard/ModuleGrid";

export default function DashboardPage() {
  return <ModuleGrid />;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ModuleGrid.tsx "app/(authenticated)/dashboard" app/dashboard
git commit -m "Add dashboard module grid and move dashboard page into authenticated route group"
```

---

### Task 8: Move the registration wizard into the route group

**Files:**
- Move: `app/register/page.tsx`, `app/register/RegistrationWizard.tsx`, `app/register/RegistrationWizard.test.tsx` &rarr; `app/(authenticated)/register/`

**Interfaces:**
- No new interfaces. `app/(authenticated)/register/page.tsx` keeps its existing `canProvisionUsers` redirect check unchanged — the layout's own session check (Task 9) is defense-in-depth, not a replacement for this route's specific permission gate.

- [ ] **Step 1: Move the whole directory**

```bash
mkdir -p "app/(authenticated)/register"
git mv app/register/page.tsx "app/(authenticated)/register/page.tsx"
git mv app/register/RegistrationWizard.tsx "app/(authenticated)/register/RegistrationWizard.tsx"
git mv app/register/RegistrationWizard.test.tsx "app/(authenticated)/register/RegistrationWizard.test.tsx"
```

The relative import `import { RegistrationWizard } from "./RegistrationWizard";` in `page.tsx` still resolves correctly since all three files moved together.

- [ ] **Step 2: Adjust the page's outer layout for nesting inside the shell**

The wizard page currently assumes it owns the full viewport (`min-h-screen`). Once nested inside the authenticated shell's `<main>` (next to the Navbar and Sidebar), it needs to fill the *available* space instead. In `app/(authenticated)/register/page.tsx`, change:

```tsx
    <div className="flex min-h-screen">
```

to:

```tsx
    <div className="flex flex-1">
```

The rest of the file is unchanged.

- [ ] **Step 3: Run the wizard's existing tests from the new location**

Run: `npx vitest run "app/(authenticated)/register/RegistrationWizard.test.tsx"`
Expected: PASS, same test count as before the move (these tests only import the component directly and don't depend on the file's route location).

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/register" app/register
git commit -m "Move registration wizard into authenticated route group"
```

---

### Task 9: Authenticated layout wiring it all together

**Files:**
- Create: `app/(authenticated)/layout.tsx`
- Test: `app/(authenticated)/layout.test.tsx`

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE_NAME` (`lib/auth/session.ts`); `canProvisionUsers` (`lib/auth/permissions.ts`); `prisma` (`lib/prisma.ts`); `ThemeShell` (Task 4); `Navbar` (Task 4); `Sidebar` (Task 5).
- Produces: the shared layout Next.js applies to every page under `app/(authenticated)/` (dashboard, register, profile, settings, transactions/*).

- [ ] **Step 1: Write the failing layout test**

```typescript
// app/(authenticated)/layout.test.tsx
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const cookiesMock = vi.fn();
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

const verifySessionTokenMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  verifySessionToken: (...args: unknown[]) =>
    verifySessionTokenMock(...args),
  SESSION_COOKIE_NAME: "session",
}));

const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookiesMock.mockReset();
    verifySessionTokenMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("redirects to /login when there is no session cookie", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    verifySessionTokenMock.mockResolvedValue(null);

    await expect(
      AuthenticatedLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("looks up the caller's theme preference for an authenticated session", async () => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "a-token" }) });
    verifySessionTokenMock.mockResolvedValue({
      sub: "user_1",
      email: "juan@company.com",
      firstName: "Juan",
      lastName: "Dela Cruz",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });
    findUniqueMock.mockResolvedValue({ themePreference: "DARK" });

    await AuthenticatedLayout({ children: null });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { themePreference: true },
    });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run "app/(authenticated)/layout.test.tsx"`
Expected: FAIL — `layout.tsx` does not exist yet.

- [ ] **Step 3: Implement the layout**

```tsx
// app/(authenticated)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ThemeShell } from "@/components/dashboard/ThemeShell";
import { Navbar } from "@/components/dashboard/Navbar";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { themePreference: true },
  });

  return (
    <ThemeShell initialTheme={user?.themePreference ?? "LIGHT"}>
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar canProvisionUsers={canProvisionUsers(session)} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </ThemeShell>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run "app/(authenticated)/layout.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/layout.tsx" "app/(authenticated)/layout.test.tsx"
git commit -m "Add authenticated layout wiring navbar, sidebar, and theme shell together"
```

---

### Task 10: Full verification and handoff

**Files:** None (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass except the same pre-existing, unrelated `prisma/seed.test.ts` failure documented in the handoff doc (fails only if the live seed admin's password was already changed through the app — not a regression).

- [ ] **Step 2: Run a production build to catch type/build errors**

Run: `npm run build`
Expected: build succeeds with no TypeScript or Next.js errors, including for the new `(authenticated)` route group and its pages.

- [ ] **Step 3: Start the dev server and hand off for a live walkthrough**

Run: `npm run dev`

Ask the user to check, logged in with their own account:
- `/dashboard` shows the navy navbar (brand + theme toggle) and left sidebar (Dashboard, Profile, Settings, Logout, plus Register User only if their account has that permission), with the 4 module tiles (Open/Approved/Canceled Transaction, My Approvals) each showing `—`.
- Clicking a module tile navigates to its placeholder page (still inside the shell).
- Clicking the theme toggle switches the main content area between light and dark immediately, and the choice survives a full page reload (confirms the `PATCH /api/user/theme` persistence round-trip).
- `/register` (if their account can reach it) still renders the 3-step wizard, now inside the shell instead of full-screen.
- Visiting `/dashboard` while logged out still redirects to `/login` (existing `proxy.ts` behavior, unchanged).

- [ ] **Step 4: Address any feedback, then confirm no secrets are committed**

Run: `git status` and `git diff --stat` to confirm `.env` was never staged and nothing unexpected is in the working tree.

No separate commit here — each task already committed its own work incrementally.
