# Green Rebrand & Login/Registration Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand Outslip VMS from navy to Mega Fishing green (#2C7001), redesign login/register/change-password as centered cards, and remove the dark-mode theme system entirely.

**Architecture:** Pure reskin plus feature removal — no behavior changes to auth, sessions, permissions, or validation. The theme system (toggle, context, API route, DB column) is deleted; three entry pages get a shared centered-card visual language; the authenticated shell keeps its exact layout with new colors.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Prisma 6/Postgres (Neon), Vitest 4 + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-19-green-rebrand-login-register-design.md`

## Global Constraints

- Branch: `green-rebrand`, forked from `main` @ `6e277ec`.
- Colors — exact values, no substitutes: primary green `#2C7001`; sidebar green `#245c01`; banner gradient `#2C7001 → #1d4d00` (`bg-gradient-to-br from-[#2C7001] to-[#1d4d00]`); page backdrop `#eef1ee`. Navy `#0b2545` and companion tints (`#e8eef7`, `#9fb0c9`, `#8593a8`) must not survive anywhere in app code.
- The ONLY user-visible text change in the whole plan: the login submit button "SIGN IN" → "Login". Every other label, button text, heading, and message stays byte-identical (the wizard/change-password tests depend on them).
- `@` import alias resolves to the project root.
- `npm install` scripts are restricted — use `npm install --ignore-scripts` (no new deps are expected in this plan).
- Run `npx vitest run` (full suite, not just the changed file) before each commit. Known flake: Neon cold-start `P1001`/connection errors on DB-backed tests — retry the single failing file once before concluding anything is broken.
- `npm run build` must pass in every task that touches components or pages.
- This is Next.js 16 (newer than training data) — consult `node_modules/next/dist/docs/` before assuming API behavior.

## File Structure

| File | Fate |
|---|---|
| `components/dashboard/ThemeShell.tsx`, `ThemeToggle.tsx`, `ThemeToggle.test.tsx` | deleted (Task 1) |
| `app/api/user/theme/route.ts`, `route.test.ts`, `lib/validation/theme.ts` | deleted (Task 1) |
| `components/dashboard/Navbar.tsx` | rewritten green, toggle removed (Task 1) |
| `app/(authenticated)/layout.tsx`, `layout.test.tsx` | rewritten — no ThemeShell, no prisma (Task 1) |
| `app/globals.css` | dark-mode machinery removed (Task 1) |
| `prisma/schema.prisma` + new migration | drop `themePreference` + `Theme` enum (Task 2) |
| `components/dashboard/Sidebar.tsx`, `ModuleGrid.tsx`, `components/PagePlaceholder.tsx` | recolored (Task 3) |
| `components/PasswordInput.tsx` | gains `inputClassName` prop (Task 4) |
| `app/login/page.tsx`, `LoginForm.tsx`, `LoginForm.test.tsx` | redesigned (Task 4) |
| `app/change-password/page.tsx`, `ChangePasswordForm.tsx` | redesigned (Task 5) |
| `app/(authenticated)/register/page.tsx`, `RegistrationWizard.tsx` | redesigned (Task 6) |

---

### Task 1: Remove the theme system

**Files:**
- Delete: `components/dashboard/ThemeShell.tsx`, `components/dashboard/ThemeToggle.tsx`, `components/dashboard/ThemeToggle.test.tsx`, `app/api/user/theme/route.ts`, `app/api/user/theme/route.test.ts`, `lib/validation/theme.ts`
- Modify: `components/dashboard/Navbar.tsx`, `app/(authenticated)/layout.tsx`, `app/(authenticated)/layout.test.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: existing `verifySessionToken`, `SESSION_COOKIE_NAME` (`lib/auth/session.ts`), `canProvisionUsers` (`lib/auth/permissions.ts`), `Navbar`, `Sidebar`.
- Produces: `Navbar()` with no ThemeToggle dependency (final green version, consumed as-is by later tasks); `AuthenticatedLayout` with no prisma/theme dependency. `prisma.user.themePreference` is no longer referenced by any code (Task 2 relies on this).

- [ ] **Step 1: Update the layout test to drop the theme lookup (failing first)**

Replace the entire contents of `app/(authenticated)/layout.test.tsx` with:

```tsx
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, cookiesMock, verifySessionTokenMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  cookiesMock: vi.fn(),
  verifySessionTokenMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/auth/session", () => ({
  verifySessionToken: (...args: unknown[]) =>
    verifySessionTokenMock(...args),
  SESSION_COOKIE_NAME: "session",
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookiesMock.mockReset();
    verifySessionTokenMock.mockReset();
  });

  it("redirects to /login when there is no session cookie", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    verifySessionTokenMock.mockResolvedValue(null);

    await expect(
      AuthenticatedLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("renders the shell for an authenticated session without redirecting", async () => {
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

    await expect(
      AuthenticatedLayout({ children: null })
    ).resolves.toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run "app/(authenticated)/layout.test.tsx"`
Expected: FAIL — the current `layout.tsx` imports `@/lib/prisma`, which the test no longer mocks, so the prisma client initializes/queries against the mocked-nothing path (error mentioning prisma or a failed `findUnique`).

- [ ] **Step 3: Rewrite the layout without theme**

Replace the entire contents of `app/(authenticated)/layout.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar canProvisionUsers={canProvisionUsers(session)} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the Navbar green, without the toggle**

Replace the entire contents of `components/dashboard/Navbar.tsx` with:

```tsx
export function Navbar() {
  return (
    <header className="flex items-center bg-[#2C7001] px-6 py-3 text-white">
      <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
        <span aria-hidden>⛨</span>
        OUTSLIP VMS
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Delete the theme files**

```bash
git rm components/dashboard/ThemeShell.tsx components/dashboard/ThemeToggle.tsx components/dashboard/ThemeToggle.test.tsx lib/validation/theme.ts
git rm -r app/api/user/theme
```

- [ ] **Step 6: Remove dark-mode machinery from globals.css**

Replace the entire contents of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

(Removed: the `@custom-variant dark` line and the `@media (prefers-color-scheme: dark)` block — the app is light-only regardless of OS setting.)

- [ ] **Step 7: Run the layout test, verify it passes**

Run: `npx vitest run "app/(authenticated)/layout.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 8: Full suite + build**

Run: `npx vitest run` — expected: all remaining tests pass (the deleted theme tests are gone; nothing else references the deleted modules).
Run: `npm run build` — expected: clean compile; the `/api/user/theme` route disappears from the route list.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Remove dark-mode theme system"
```

---

### Task 2: Drop themePreference from the database

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260719000000_drop_theme_preference/migration.sql`

**Interfaces:**
- Consumes: Task 1's guarantee that no code references `themePreference` or the `Theme` enum.
- Produces: a `User` model without `themePreference`; Prisma client regenerated to match.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, delete these two blocks/lines exactly:

```prisma
enum Theme {
  LIGHT
  DARK
}
```

and, inside `model User`:

```prisma
  themePreference    Theme    @default(LIGHT)
```

- [ ] **Step 2: Write the migration by hand** (avoids `prisma migrate dev`'s interactive data-loss prompt, which fails in a non-interactive shell)

Create `prisma/migrations/20260719000000_drop_theme_preference/migration.sql`:

```sql
-- Drop the per-user theme preference; the app is light-only now.
ALTER TABLE "User" DROP COLUMN "themePreference";

-- Drop the now-unused enum type.
DROP TYPE "Theme";
```

- [ ] **Step 3: Apply and regenerate**

Run: `npx prisma migrate deploy`
Expected: `1 migration applied` (`20260719000000_drop_theme_preference`). If Neon is cold-starting, retry once.

Run: `npx prisma generate`
Expected: client regenerated without errors.

- [ ] **Step 4: Verify no stale references, run suite**

Run: `grep -rn "themePreference" app components lib prisma --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: only `prisma/migrations/**` hits (SQL history), no `.ts`/`.tsx` hits.

Run: `npx vitest run`
Expected: all pass (the register/login/seed flows never referenced the column).

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add prisma
git commit -m "Drop themePreference column and Theme enum"
```

---

### Task 3: Recolor the authenticated shell green

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`, `components/dashboard/ModuleGrid.tsx`, `components/PagePlaceholder.tsx`

**Interfaces:**
- Consumes: nothing new. Component props and rendered text are unchanged — `Sidebar.test.tsx` must keep passing untouched.
- Produces: the final shell palette later tasks render inside.

- [ ] **Step 1: Sidebar — one class change**

In `components/dashboard/Sidebar.tsx`, change the `<nav>` className from:

```
flex w-48 flex-shrink-0 flex-col gap-1 bg-[#0b2545] p-4 text-sm text-white
```

to:

```
flex w-48 flex-shrink-0 flex-col gap-1 bg-[#245c01] p-4 text-sm text-white
```

Nothing else in the file changes.

- [ ] **Step 2: ModuleGrid — green accents, drop dark variants**

Replace the entire contents of `components/dashboard/ModuleGrid.tsx` with:

```tsx
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
          className="rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white p-4 shadow-sm hover:shadow-md"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {module.label}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#2C7001]">
            —
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: PagePlaceholder — green title, drop dark variants**

Replace the entire contents of `components/PagePlaceholder.tsx` with:

```tsx
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="text-xl font-bold text-[#2C7001]">
        {title}
      </h1>
      <p className="text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Suite + build**

Run: `npx vitest run` — expected: all pass, including `Sidebar.test.tsx` unchanged.
Run: `npm run build` — expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Sidebar.tsx components/dashboard/ModuleGrid.tsx components/PagePlaceholder.tsx
git commit -m "Recolor authenticated shell to Mega Fishing green"
```

---

### Task 4: Login page redesign

**Files:**
- Modify: `components/PasswordInput.tsx`, `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/login/LoginForm.test.tsx`

**Interfaces:**
- Consumes: existing `LoginForm` fetch/redirect logic (unchanged).
- Produces: `PasswordInput` gains optional `inputClassName?: string` — when provided it REPLACES the default input classes entirely (callers passing it must include their own width/padding-right for the eye button). Task 6 uses this same prop.

- [ ] **Step 1: Update LoginForm tests for the button rename (failing first)**

In `app/login/LoginForm.test.tsx`, replace all THREE occurrences of:

```tsx
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
```

with:

```tsx
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: FAIL, 3 tests — no button named "Login" yet.

- [ ] **Step 3: Add `inputClassName` to PasswordInput**

In `components/PasswordInput.tsx`, change the type and component head to:

```tsx
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
  inputClassName?: string;
};

export function PasswordInput({
  wrapperClassName,
  inputClassName,
  ...props
}: PasswordInputProps) {
```

and the `<input>` className to:

```tsx
        className={
          inputClassName ??
          "h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 pr-9 text-sm"
        }
```

Nothing else in the file changes (`PasswordInput.test.tsx` passes untouched).

- [ ] **Step 4: Rewrite the login page**

Replace the entire contents of `app/login/page.tsx` with:

```tsx
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1ee] p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-10 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className="text-2xl font-extrabold tracking-widest text-white">
            SIGN IN
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className="mb-6 text-center text-xs text-slate-400">
            Sign in with your company or personal email
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Restyle the LoginForm** (logic, state, and fetch flow are byte-identical — only the returned JSX changes)

Replace the `return (...)` block of `app/login/LoginForm.tsx` with:

```tsx
  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="mb-5 flex items-center gap-4">
        <label
          htmlFor="email"
          className="w-20 shrink-0 text-[13px] text-slate-500"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Enter email"
          className="w-full border-b border-slate-300 bg-transparent pb-1.5 text-sm placeholder:text-slate-300 focus:border-[#2C7001] focus:outline-none"
        />
      </div>

      <div className="mb-2 flex items-center gap-4">
        <label
          htmlFor="password"
          className="w-20 shrink-0 text-[13px] text-slate-500"
        >
          Password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter password"
          inputClassName="w-full border-b border-slate-300 bg-transparent pb-1.5 pr-9 text-sm placeholder:text-slate-300 focus:border-[#2C7001] focus:outline-none"
        />
      </div>

      <a href="#" className="mb-6 self-end text-xs font-semibold text-[#2C7001]">
        Forgot Password?
      </a>

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Login
      </button>
    </form>
  );
```

(The old link text "Forgot password?" becomes "Forgot Password?" — no test references it.)

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run app/login/LoginForm.test.tsx components/PasswordInput.test.tsx`
Expected: PASS — 3 + 2 tests.

- [ ] **Step 7: Full suite + build**

Run: `npx vitest run` — expected: all pass.
Run: `npm run build` — expected: clean.

- [ ] **Step 8: Commit**

```bash
git add components/PasswordInput.tsx app/login
git commit -m "Redesign login page as centered green card"
```

---

### Task 5: Change-password page redesign

**Files:**
- Modify: `app/change-password/page.tsx`, `app/change-password/ChangePasswordForm.tsx`

**Interfaces:**
- Consumes: nothing new. Labels ("New Password", "Confirm Password") and the button text ("UPDATE PASSWORD") are unchanged — `ChangePasswordForm.test.tsx` must keep passing untouched.
- Produces: nothing consumed later.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/change-password/page.tsx` with:

```tsx
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1ee] p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-8 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className="text-xl font-extrabold tracking-widest text-white">
            SET A NEW PASSWORD
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className="mb-6 text-center text-xs text-slate-400">
            Your account was created with a temporary password. Choose a new
            one to continue.
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restyle the form** (logic identical — only the returned JSX changes)

Replace the `return (...)` block of `app/change-password/ChangePasswordForm.tsx` with:

```tsx
  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <label htmlFor="newPassword" className="text-xs text-slate-500">
        New Password
      </label>
      <input
        id="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
      />

      <label htmlFor="confirmPassword" className="text-xs text-slate-500">
        Confirm Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        className="mb-5 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
      />

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mx-auto rounded-full bg-[#2C7001] px-10 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        UPDATE PASSWORD
      </button>
    </form>
  );
```

- [ ] **Step 3: Run the form's tests untouched, then full suite + build**

Run: `npx vitest run app/change-password/ChangePasswordForm.test.tsx`
Expected: PASS, 2 tests, zero edits to the test file.

Run: `npx vitest run` — expected: all pass.
Run: `npm run build` — expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/change-password
git commit -m "Redesign change-password page as centered green card"
```

---

### Task 6: Register page card + wizard reskin

**Files:**
- Modify: `app/(authenticated)/register/page.tsx`, `app/(authenticated)/register/RegistrationWizard.tsx`

**Interfaces:**
- Consumes: `PasswordInput`'s `inputClassName` prop from Task 4.
- Produces: nothing consumed later. `RegistrationWizard.test.tsx` (label/button-text based) must keep passing with ZERO edits — every label, button text, heading, and message in the wizard stays byte-identical.

- [ ] **Step 1: Rewrite the register page** (the server-side permission check is byte-identical; only the JSX changes)

Replace the entire contents of `app/(authenticated)/register/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { RegistrationWizard } from "./RegistrationWizard";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canProvisionUsers(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-start justify-center bg-[#eef1ee] p-8">
      <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
          />
          <h1 className="text-lg font-extrabold tracking-widest text-white">
            REGISTER USER
          </h1>
        </div>
        <div className="px-8 py-7">
          <RegistrationWizard />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reskin the wizard via exact string replacements**

In `app/(authenticated)/register/RegistrationWizard.tsx`, apply these replacements. "ALL" means replace every occurrence; counts are what you must find — if a count differs, stop and re-read the file.

1. ALL (1×), StepIndicator active circle:
   - old: `n <= step ? "bg-[#0b2545] text-white" : "bg-slate-200 text-slate-500"`
   - new: `n <= step ? "bg-[#2C7001] text-white" : "bg-slate-200 text-slate-500"`
2. ALL (1×), StepIndicator connector:
   - old: `` `h-0.5 flex-1 ${n < step ? "bg-[#0b2545]" : "bg-slate-200"}` ``
   - new: `` `h-0.5 flex-1 ${n < step ? "bg-[#2C7001]" : "bg-slate-200"}` ``
3. ALL (4×), section headings (success, step 1, step 2, step 3):
   - old: `text-[#0b2545]`
   - new: `text-[#2C7001]`
   (After replacements 1–2 the only remaining `#0b2545` occurrences are `text-` usages — this is why 1 and 2 run first.)
4. ALL (3×), primary buttons with `px-5` (success "REGISTER ANOTHER USER", step 2 "NEXT →", step 3 "SUBMIT REGISTRATION"):
   - old: `rounded bg-[#0b2545] px-5`
   - new: `rounded-full bg-[#2C7001] px-5`
5. ALL (1×), step 1 "NEXT →" button:
   - old: `rounded bg-[#0b2545] px-6`
   - new: `rounded-full bg-[#2C7001] px-6`
6. ALL (2×), "← BACK" buttons:
   - old: `rounded border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600`
   - new: `rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500`
7. ALL (7×), text inputs and step-2 selects:
   - old: `mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm`
   - new: `mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none`
8. ALL (1×), step 1 role select:
   - old: `mb-2 block h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm`
   - new: `mb-2 block h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none`
9. ALL (1×), step 2 Password field — add the underline input class:
   - old:
     ```tsx
        <PasswordInput
          id="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          wrapperClassName="mb-3"
        />
     ```
   - new:
     ```tsx
        <PasswordInput
          id="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          wrapperClassName="mb-4"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />
     ```
10. ALL (1×), step 2 Confirm Password field:
    - old:
      ```tsx
        <PasswordInput
          id="confirmPassword"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          wrapperClassName="mb-4"
        />
      ```
    - new:
      ```tsx
        <PasswordInput
          id="confirmPassword"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          wrapperClassName="mb-5"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />
      ```

Then verify no navy remains: `grep -c "0b2545" "app/(authenticated)/register/RegistrationWizard.tsx"` → expected `0`.

- [ ] **Step 3: Run the wizard tests untouched**

Run: `npx vitest run "app/(authenticated)/register/RegistrationWizard.test.tsx"`
Expected: PASS, 2 tests, zero edits to the test file.

- [ ] **Step 4: Full suite + build**

Run: `npx vitest run` — expected: all pass.
Run: `npm run build` — expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/register"
git commit -m "Redesign register page as centered green card"
```

---

### Task 7: Full verification and handoff

**Files:** None (verification only).

- [ ] **Step 1: No navy, no dark variants anywhere in app code**

Run: `grep -rn "0b2545\|dark:\|e8eef7\|9fb0c9\|8593a8" app components lib --include="*.tsx" --include="*.ts" --include="*.css"`
Expected: zero hits.

- [ ] **Step 2: Full suite**

Run: `npx vitest run`
Expected: all pass (retry a single Neon cold-start failure once if one appears).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean; route list no longer contains `/api/user/theme`.

- [ ] **Step 4: Live walkthrough** (dev server + browser)

Run `npm run dev`, then verify logged in as a provisioning admin:
- `/login` — gray backdrop, centered card, green gradient "SIGN IN" banner, side labels with underlined inputs, "Sign in with your company or personal email" subtitle, right-aligned "Forgot Password?", green pill "Login" button. No Remember-me.
- Logging in with a `mustChangePassword` account lands on the redesigned `/change-password` card; completing it proceeds to `/dashboard`.
- `/dashboard` — green navbar (no theme toggle anywhere), darker-green sidebar, module tiles with green accents.
- `/register` — centered card with "REGISTER USER" banner inside the shell; all 3 wizard steps work; step indicator and buttons are green pills.
- Logged out, `/dashboard` still redirects to `/login`.

- [ ] **Step 5: No secrets committed**

Run: `git status` and `git diff --stat` — clean tree, no `.env` staged.
