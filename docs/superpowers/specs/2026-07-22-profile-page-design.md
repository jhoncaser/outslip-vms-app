# Profile Page — Design

**Date:** 2026-07-22
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming` with the visual companion, session `757-1784710449`, 3 mockup options — user picked Option B)

## Goal

Turn `/profile` from an unbuilt `PagePlaceholder` into a read-only page showing the currently logged-in user's own account details: name, role, job title, email, department, business unit, location, and member-since date.

## Scope

- **View-only, own account only.** No edit button, no form, no route param — always the currently authenticated user's own data. Editing (which was considered and explicitly declined in favor of this simpler version) is out of scope for this round.
- No permission gate beyond the existing session middleware — every authenticated user can view their own profile, matching `app/(authenticated)/dashboard/page.tsx`'s pattern of no additional gate.

## Design

### 1. Data flow

The session JWT (`lib/auth/session.ts`'s `SessionPayload`) carries `sub`, `email`, `firstName`, `lastName`, `role`, `department`, `mustChangePassword` — but not `jobTitle`, `businessUnit`, `location`, or `createdAt`. So `page.tsx` fetches the full row fresh from Prisma by the session's user id, the same pattern already used by `app/(authenticated)/register/page.tsx`:

```ts
const cookieStore = await cookies();
const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
const session = token ? await verifySessionToken(token) : null;
if (!session) redirect("/login");

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
```

Only display fields are selected — `passwordHash` is never fetched. `middleName` is deliberately not shown, matching the Users table (`app/(authenticated)/register/UsersView.tsx`), which also never displays it — full name is rendered as `"${firstName} ${lastName}"` everywhere else in this app, and Profile follows the same convention.

### 2. Components

**`page.tsx` (rewritten):** server component. Session lookup + redirect-if-unauthenticated (mirrors the layout's own guard, defense in depth — though the route group's middleware already guarantees this). Fetches the user row above, computes:

```ts
const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
```

(the exact formula already used in `app/(authenticated)/layout.tsx` for the navbar avatar), formats `createdAt` with the same `en-US`/`{ month: "short", day: "numeric", year: "numeric" }` options used everywhere else in this app, and renders the full-bleed `bg-[#eef1ee]` + MFC watermark overlay wrapper (identical to every other authenticated page) around `<ProfileView ... />`.

**`ProfileView.tsx` (new):** plain presentational component — **no `"use client"`**, nothing on this page is interactive. Props:

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
  memberSince: string; // pre-formatted display string
};
```

`roleLabel` is resolved via the existing `ROLE_LABELS` map (`lib/roles.ts`) — `page.tsx` passes `ROLE_LABELS[user.role]`, so `ProfileView` itself has no knowledge of the `Role` enum.

### 3. Layout (Option B: banner + details grid)

```
┌───────────────────────────────────────────┐
│  (green gradient banner)                   │
│   ⊙ Initials   Full Name                   │
│               Job Title · [Role pill]      │
├───────────────────────────────────────────┤
│  (white card)                              │
│   EMAIL              DEPARTMENT            │
│   value               value                │
│   BUSINESS UNIT       LOCATION             │
│   value               value                │
│   MEMBER SINCE                             │
│   value                                    │
└───────────────────────────────────────────┘
```

- Banner: `bg-gradient-to-br from-[#2C7001] to-[#1d4d00]`, matching the gradient already used on the Add Transaction / QR enlarge modal headers. Avatar is a `bg-white/20` circle with the initials, same visual treatment as the Navbar's user badge. Role renders as a `bg-white/20` pill (**not** the pastel color-coded pills from `UsersView.tsx` — those colors are calibrated for a white table background and would lose contrast on dark green; no new shared component needed, this is a one-off treatment local to `ProfileView.tsx`).
- Card: white, `rounded-b-xl shadow` (banner supplies the top corners), 2-column grid (`grid-cols-2 gap-x-8 gap-y-4`) for Email/Department/Business Unit/Location, with Member Since spanning both columns (`col-span-2`) as the last row. Label styling (small, uppercase, muted) matches the existing `labelClassName` convention used on the Login/Change Password/Add Transaction forms.
- Page wrapper: identical `bg-[#eef1ee]` + `bg-[url('/mfc-logo.png')] opacity-[0.18]` overlay pattern already present in every other authenticated page (including the current placeholder version of this exact file).

### 4. Testing

- **`ProfileView.test.tsx` (new):** renders `ProfileView` directly with sample props — asserts full name, job title, role label + pill, email, department, business unit, location, and member-since date all appear; asserts the initials render inside the avatar.
- `page.tsx` is not tested directly, consistent with every other page in this app (`dashboard/page.tsx`, `register/page.tsx`, `settings/page.tsx`, `transactions/open/page.tsx` — none have a dedicated test file; their only logic is session lookup + Prisma fetch + formatting, exercised via the component tests of what they render into).

## Out of scope

- Editing any profile field (name, job title, email, etc.) — considered and explicitly declined by the user in favor of a simpler read-only page.
- Viewing another user's profile (that's the existing admin-only edit-user flow under `/register`).
- Avatar photo upload — no such field exists on the `User` model.
- Any change to the `User` model, session payload, or Prisma schema.
