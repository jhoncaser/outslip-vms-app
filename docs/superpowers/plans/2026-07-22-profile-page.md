# Profile Page (Read-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/profile` from an unbuilt `PagePlaceholder` into a read-only page showing the currently logged-in user's own account details (name, role, job title, email, department, business unit, location, member-since date).

**Architecture:** A new presentational `ProfileView` component (no `"use client"`, nothing on the page is interactive) renders a green banner + white details-grid card. `app/(authenticated)/profile/page.tsx` is rewritten from a `PagePlaceholder` wrapper into a server component that looks up the session, fetches the full user row from Prisma by `session.sub` (the JWT doesn't carry `jobTitle`/`businessUnit`/`location`/`createdAt`), formats display values server-side, and renders `ProfileView`.

**Tech Stack:** Next.js 16 App Router (server components), Prisma, Tailwind CSS v4, Vitest + Testing Library.

## Global Constraints

- View-only, own account only — no edit button, no form, no route param, ever the currently authenticated user's own data (per spec §Scope).
- No permission gate beyond the existing session middleware — every authenticated user can view their own profile (per spec §Scope).
- Only display fields are selected from Prisma — `passwordHash` is never fetched (per spec §1).
- `middleName` is never shown — full name is always `"${firstName} ${lastName}"`, matching every other full-name render in this app (per spec §1).
- `ProfileView.tsx` has no `"use client"` directive — first `*View.tsx` component in this app that isn't a client component (per spec §2).
- Role pill on the banner uses `bg-white/20` (not `UsersView.tsx`'s pastel role-color pills, which lose contrast on dark green) — local, one-off treatment, no new shared component (per spec §3).
- Dates are formatted server-side in `page.tsx` using `"en-US"` / `{ month: "short", day: "numeric", year: "numeric" }`, the same options used in `register/page.tsx` and `settings/page.tsx` (per spec §1, §3).
- `page.tsx` itself is not given a dedicated test file — consistent with every other page in this app (per spec §4).
- No changes to the `User` model, session payload, or Prisma schema (per spec §Out of scope).

---

### Task 1: `ProfileView` presentational component

**Files:**
- Create: `app/(authenticated)/profile/ProfileView.tsx`
- Test: `app/(authenticated)/profile/ProfileView.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure presentational component, all data arrives via props).
- Produces (consumed by Task 2):
  ```ts
  export type ProfileViewProps = {
    fullName: string;
    initials: string;
    jobTitle: string;
    roleLabel: string;
    email: string;
    department: string;
    businessUnit: string;
    location: string;
    memberSince: string; // pre-formatted display string, e.g. "Jul 18, 2026"
  };
  export function ProfileView(props: ProfileViewProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `app/(authenticated)/profile/ProfileView.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileView, type ProfileViewProps } from "./ProfileView";

const sampleProps: ProfileViewProps = {
  fullName: "Juan Dela Cruz",
  initials: "JD",
  jobTitle: "IT Officer",
  roleLabel: "1st Level Approver",
  email: "juan@example.com",
  department: "ICT",
  businessUnit: "Cawit",
  location: "Zamboanga",
  memberSince: "Jul 18, 2026",
};

describe("ProfileView", () => {
  it("renders the banner with full name, initials, job title, and role pill", () => {
    render(<ProfileView {...sampleProps} />);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    expect(screen.getByText("1st Level Approver")).toBeInTheDocument();
  });

  it("renders the details grid with email, department, business unit, location, and member-since date", () => {
    render(<ProfileView {...sampleProps} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("juan@example.com")).toBeInTheDocument();
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Business Unit")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Zamboanga")).toBeInTheDocument();
    expect(screen.getByText("Member Since")).toBeInTheDocument();
    expect(screen.getByText("Jul 18, 2026")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(authenticated)/profile/ProfileView.test.tsx"`
Expected: FAIL — `Failed to resolve import "./ProfileView"` (the module doesn't exist yet).

- [ ] **Step 3: Write the component**

Create `app/(authenticated)/profile/ProfileView.tsx`:

```tsx
export type ProfileViewProps = {
  fullName: string;
  initials: string;
  jobTitle: string;
  roleLabel: string;
  email: string;
  department: string;
  businessUnit: string;
  location: string;
  memberSince: string;
};

const fieldLabelClassName = "mb-1 text-xs font-semibold text-slate-600";
const fieldValueClassName = "text-sm text-slate-800";

export function ProfileView({
  fullName,
  initials,
  jobTitle,
  roleLabel,
  email,
  department,
  businessUnit,
  location,
  memberSince,
}: ProfileViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl shadow">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-8 py-7">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
            {initials}
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">{fullName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
              <span>{jobTitle}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-b-xl bg-white px-8 py-7">
        <div>
          <p className={fieldLabelClassName}>Email</p>
          <p className={fieldValueClassName}>{email}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Department</p>
          <p className={fieldValueClassName}>{department}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Business Unit</p>
          <p className={fieldValueClassName}>{businessUnit}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Location</p>
          <p className={fieldValueClassName}>{location}</p>
        </div>
        <div className="col-span-2">
          <p className={fieldLabelClassName}>Member Since</p>
          <p className={fieldValueClassName}>{memberSince}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(authenticated)/profile/ProfileView.test.tsx"`
Expected: PASS — 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/profile/ProfileView.tsx" "app/(authenticated)/profile/ProfileView.test.tsx"
git commit -m "Add read-only ProfileView component"
```

---

### Task 2: Wire `page.tsx` to fetch the session user and render `ProfileView`

**Files:**
- Modify: `app/(authenticated)/profile/page.tsx` (currently renders `PagePlaceholder`, full rewrite)

**Interfaces:**
- Consumes: `ProfileView`, `ProfileViewProps` from `./ProfileView` (Task 1).
- Produces: nothing consumed by a later task — this is the last task in the plan.

- [ ] **Step 1: Rewrite `page.tsx`**

Replace the full contents of `app/(authenticated)/profile/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
    select: {
      firstName: true,
      lastName: true,
      jobTitle: true,
      email: true,
      role: true,
      createdAt: true,
      department: { select: { name: true } },
      businessUnit: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const memberSince = user.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <ProfileView
          fullName={fullName}
          initials={initials}
          jobTitle={user.jobTitle}
          roleLabel={ROLE_LABELS[user.role]}
          email={user.email}
          department={user.department.name}
          businessUnit={user.businessUnit.name}
          location={user.location.name}
          memberSince={memberSince}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove the now-unused `PagePlaceholder` import check**

Confirm no other file needs the `Profile` placeholder wiring removed — `PagePlaceholder` itself stays in place (still used by the 4 transaction placeholder pages), only this file's usage of it is gone. No action needed beyond the rewrite in Step 1.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS on every file except the known `prisma/seed.test.ts` baseline failure (seed admin has a real, user-set password — see the branch handoff doc §5). No other file should fail or change count from the pre-task baseline.

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: clean build, no type errors, `/profile` listed in the route output.

- [ ] **Step 5: Manually verify against the running dev server**

If a dev server is already running on port 3000 (check the branch handoff doc's environment notes), navigate to `http://localhost:3000/profile` while logged in and confirm:
- Green banner shows initials, full name, job title, and role pill.
- White card below shows Email, Department, Business Unit, Location, and Member Since with real values for the logged-in account.
- No console errors.

If no dev server is running, start one (`npm run dev`) first.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/profile/page.tsx"
git commit -m "Wire Profile page to session user data via ProfileView"
```
