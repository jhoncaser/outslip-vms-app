# Outslip VMS — Post-Login Dashboard Shell Design

## Status

Covers the authenticated navigation shell (navbar, sidebar, dark/light theme)
and the dashboard landing page's visual layout only. The actual Transaction
data model — what a transaction is, how it moves between Open/Approved/
Canceled, how "My Approvals" is scoped — is explicitly deferred to a later
design pass, same as the broader system-behavior deferral in the
registration/login spec. This pass builds the shell and placeholder pages
that later work will fill in.

## Overview

Today, `/dashboard` is a bare placeholder: a centered "logged in as" message
and a sign-out button, with no navigation. This pass replaces it with a
persistent authenticated shell — top navbar + left sidebar — that every
authenticated page (dashboard, profile, settings, register, and future
transaction pages) shares, plus a real dashboard landing page with 4 module
tiles: Open Transaction, Approved Transaction, Canceled Transaction, My
Approvals.

## Layout

**Chosen layout: top navbar + persistent left sidebar** (navy/white
"Corporate Security" theme, consistent with login/registration).

- **Navbar** (top, full width): brand/logo on the left, dark/light theme
  toggle on the right.
- **Sidebar** (left, persistent across authenticated pages): Dashboard,
  Profile, Settings, Register User (conditionally shown — see Access
  Control below), Logout.
- **Main content area**: page-specific content. On `/dashboard`, this is the
  4-tile module grid.

## Routing

A new Next.js route group, `app/(authenticated)/`, provides the shared
layout. Route groups don't change URLs — only which `layout.tsx` wraps a
page — so all URLs below are unchanged from what they'd be otherwise.

**Moved into the group (same URLs, now wrapped in the shell):**
- `app/(authenticated)/dashboard/page.tsx` (was `app/dashboard/page.tsx`)
- `app/(authenticated)/register/page.tsx` (was `app/register/page.tsx`)

**New placeholder pages (all wrapped in the shell):**
- `app/(authenticated)/profile/page.tsx`
- `app/(authenticated)/settings/page.tsx`
- `app/(authenticated)/transactions/open/page.tsx`
- `app/(authenticated)/transactions/approved/page.tsx`
- `app/(authenticated)/transactions/canceled/page.tsx`
- `app/(authenticated)/transactions/my-approvals/page.tsx`

**Stay outside the group (no shell):** `app/login/page.tsx`,
`app/change-password/page.tsx`, all `app/api/**` routes, `app/page.tsx`
(root redirect).

Each placeholder page renders a shared `PagePlaceholder` component
(`title` + short "coming soon" description) rather than duplicating markup
across 6 near-identical stub pages.

## Access Control

`app/(authenticated)/layout.tsx` (server component) performs the same
session check `app/dashboard/page.tsx` does today — verify the session
cookie, redirect to `/login` if absent — then additionally:

- Looks up the user's `themePreference` from the database.
- Computes `canProvisionUsers(session)` (existing helper in
  `lib/auth/permissions.ts` — Department = Admin AND Role in {1st, 2nd, 3rd
  Level Approver}) to decide whether the Sidebar renders the "Register
  User" link. This is a display-only convenience — the `/register` page
  and `/api/register` route already enforce this permission server-side
  regardless of whether the link is shown.

Both values are passed down as props; no new permission logic is
introduced, only a new consumer of the existing `canProvisionUsers` check.

## Dashboard Module Grid

`/dashboard` renders 4 linked tiles: Open Transaction, Approved Transaction,
Canceled Transaction, My Approvals. Each links to its corresponding
`/transactions/*` placeholder route. Since no Transaction table exists yet,
each tile shows `—` in place of a count rather than a misleading `0`.

## Dark / Light Theme (per-account)

The theme preference is tied to the user's account (not just the device),
so it follows them across sessions/devices.

**Schema change:**
```prisma
enum Theme {
  LIGHT
  DARK
}

model User {
  // ...existing fields
  themePreference Theme @default(LIGHT)
}
```
One migration: `npx prisma migrate dev --name add_theme_preference`.

**API:** `PATCH /api/user/theme`
- Requires a valid session (401 if absent).
- Body validated with Zod: `{ theme: "LIGHT" | "DARK" }` (400 on anything
  else).
- Updates only the caller's own row (`where: { id: session.sub }`) —
  there's no path for a user to change another account's preference.
- Returns `{ themePreference }` on success (200).

**Rendering flow (avoids flash-of-wrong-theme):**
1. `app/(authenticated)/layout.tsx` reads `themePreference` from the DB
   server-side and passes it as `initialTheme` to a client component,
   `ThemeShell`.
2. `ThemeShell` wraps the navbar/sidebar/content in a `<div>` whose class
   is `"dark"` when the theme is DARK, else empty — seeded from
   `initialTheme` via `useState`, so server and first client render match
   (no hydration mismatch, no flash).
3. Tailwind v4's class-based dark variant is enabled in `app/globals.css`
   via `@custom-variant dark (&:where(.dark, .dark *));` (currently the
   project only has the OS-preference media-query variant; this adds the
   explicit class-based one used here).
4. The `ThemeToggle` button (inside `Navbar`, consumes `ThemeShell`'s
   context) flips the local class immediately on click, then fires
   `PATCH /api/user/theme` to persist it.

**Error handling:** if the PATCH fails (network error or non-2xx), the
toggle is logged to the console but the visual state is **not** reverted —
this is a low-stakes preference, and interrupting the user or silently
snapping their screen back to the old theme is worse than a preference that
doesn't survive to the next session in a rare failure case.

What "dark mode" changes visually: the navbar and sidebar are already
navy (#0b2545) in both modes and don't need to change. Light mode keeps
today's white main-content background with dark text; dark mode switches
the main content area (module grid, placeholder pages) to a dark slate
background with light text, so the toggle's visible effect is concentrated
in the content area rather than restyling the whole shell.

Scope note: this only affects pages under `app/(authenticated)/`. Login,
registration, and change-password keep their existing fixed navy/white
styling — they're pre-dashboard, single-purpose pages, not part of the
themed shell.

## Components

New files under `components/dashboard/`:
- `Navbar.tsx` — server component; brand + `ThemeToggle`
- `Sidebar.tsx` — server component; static nav list, `Register User` item
  conditional on the `canProvisionUsers` prop
- `ThemeShell.tsx` — client component; owns theme state + context, renders
  the `dark`/light wrapper div
- `ThemeToggle.tsx` — client component; reads/sets `ThemeShell`'s context,
  fires the persist call
- `ModuleGrid.tsx` — server component; the 4 dashboard tiles

New shared component: `components/PagePlaceholder.tsx` (title + description
"coming soon" block), reused by Profile, Settings, and the 4 transaction
placeholder pages.

## Testing

- `app/api/user/theme/route.test.ts` (`@vitest-environment node`, mirrors
  existing route test conventions): 401 with no session; 400 on an invalid
  `theme` value; 200 and DB updated for a valid request; confirms a user
  can only ever update their own row.
- `components/dashboard/Sidebar.test.tsx`: Register User link renders only
  when `canProvisionUsers` is true, absent otherwise.
- `components/dashboard/ThemeToggle.test.tsx`: click flips the visual state
  immediately and calls `fetch` with the expected `PATCH` body; a rejected
  fetch still leaves the flipped visual state in place (no revert, no
  crash).
- `app/(authenticated)/layout.test.tsx`: redirects to `/login` when there's
  no session (same case already covered for the old `dashboard/page.tsx`,
  moved here since the layout now owns that check).

## Out of Scope (deferred to a later pass)

- The real Transaction data model, its fields, and the Open → Approved /
  Canceled status workflow.
- Any real counts or list data behind the 4 module tiles.
- Profile and Settings pages' actual content (currently placeholders).
- Role-specific dashboard content beyond the Register User sidebar link
  (e.g. a Guard-specific view) — every authenticated role sees the same
  shell and the same 4 tiles for now.
- A UI for reference-data management (`canManageReferenceData` permission)
  — no page currently exists for this and none is added here.
