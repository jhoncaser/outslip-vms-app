# Navbar & Sidebar Redesign — Design Spec

**Date:** 2026-07-19
**Branch:** green-rebrand
**Status:** Approved by user (mockup "Design 1 — Green header" selected in visual companion)

## Purpose

Replace the plain text sidebar and bare green navbar with a modern floating icon rail
and a functional header, based on a reference design the user provided (floating white
icon menu with hover label fly-outs) and refined through interactive mockups.

## What the user selected

Design 1 from the high-fidelity mockups (`.superpowers/brainstorm/1341-1784454868/content/professional-designs.html`):

- Top bar stays **green** (`#2C7001`) — brand-forward chrome.
- Sidebar becomes a **floating white icon rail** with hover label fly-outs.
- The reference's "gooey blob" morph animation is explicitly **out** — per-item hover
  pills instead (user confirmed).

## Layout — `app/(authenticated)/layout.tsx`

Overall shape unchanged: Navbar on top, sidebar left, main content right.

- The rail floats with a gap: positioned inside the flex row with margin (`~16px`)
  from the left edge, top (below navbar), and bottom.
- Main content keeps its current behavior and fills the remaining width.
- The layout passes two new props to `Navbar`: the user's initials (from the session's
  `firstName`/`lastName` first characters, uppercased — e.g. Jhon Caser → "JC") and
  full name (`firstName lastName`). The session is already verified in this layout,
  so no new data fetching.
- `Sidebar` keeps receiving `canProvisionUsers` exactly as today.

## Sidebar rail — `components/dashboard/Sidebar.tsx` (rewrite)

A `"use client"` component (needs `usePathname` for active state).

**Structure:**

- `<nav>` — white (`bg-white`), width `~68px`, `rounded-2xl`, soft shadow
  (`shadow-[0_4px_24px_rgba(20,45,8,0.10)]`), vertical flex, padding `12px 0`.
- Top group: icon links in order — Dashboard (`/dashboard`), Profile (`/profile`),
  Settings (`/settings`), Register User (`/register`, only when `canProvisionUsers`).
- Bottom group (pushed down with `mt-auto`, divider line above): Logout — still the
  existing `<form action="/api/auth/logout" method="post">` with a submit button.

**Icons:** inline SVG, Feather-style (24×24 viewBox, `stroke="currentColor"`,
`stroke-width="2"`, no fill): home, user, settings (gear), user-plus, log-out. Drawn
in-component — **no icon library dependency**.

**Item states (matches approved mockup):**

- Base: `46×44px`, `rounded-xl`, muted gray-green icon color (`#6a7a66`).
- Hover: background `#2C7001`, icon white.
- Active (current page, `usePathname` starts-with match on the link's href): background
  `#2C7001`, white icon, soft green shadow — the "green pill".
- Logout hover: background red (`red-600`), white icon; its fly-out is red too.

**Label fly-out:**

- Each item contains a `<span>` label ("Dashboard", "Profile", "Settings",
  "Register User", "Logout") positioned to the right of the rail
  (`left: calc(100% + 12px)`), pill-shaped, green background (red for Logout), white
  text, small shadow.
- Hidden by default (`opacity-0`, translated left `-8px`, `pointer-events-none`);
  shown on item **hover and keyboard focus** (`:focus-visible` within the item) by
  transitioning to full opacity and translate 0. Duration ~220ms.
- The span is always in the DOM, so it doubles as the link/button's **accessible
  name** — `getByRole("link", { name: /dashboard/i })` keeps working. No
  `aria-label` needed.
- Fly-out (and item color transitions) disabled under
  `prefers-reduced-motion: reduce` — instant show/hide, no movement.
- The fly-out needs `overflow: visible` on the rail; z-index above page content.

## Navbar — `components/dashboard/Navbar.tsx` (rewrite)

A `"use client"` component (needs `usePathname` for the page title), receiving
`initials: string` and `fullName: string` props from the layout.

**Structure (left to right), on the green `#2C7001` bar:**

1. Brand: shield SVG icon (Feather shield outline, replacing the `⛨` emoji) +
   "OUTSLIP VMS", white, bold, tracking-wide — same weight/size as today.
2. Thin vertical divider (`1px`, `bg-white/30`, `~22px` tall).
3. Current page title, white at ~90% opacity, semibold, from this pathname map:
   - `/dashboard` → "Dashboard"
   - `/profile` → "Profile"
   - `/settings` → "Settings"
   - `/register` → "Register User"
   - `/transactions/open` → "Open Transaction"
   - `/transactions/approved` → "Approved Transaction"
   - `/transactions/canceled` → "Canceled Transaction"
   - `/transactions/my-approvals` → "My Approvals"
   - Unknown path → render no title (brand + divider only; divider hidden too when
     there is no title).
4. Spacer (`flex-1`).
5. Avatar: `30px` circle, `bg-white/20`, white initials text, with `title={fullName}`
   tooltip. **Not** a button/menu — static display only (menu is future work).

## Out of scope

- Gooey blob morph animation (explicitly declined in favor of hover pills).
- Avatar dropdown menu (logout stays in the rail; menu is future work).
- Mobile/responsive collapse behavior — desktop internal tool, rail always visible.
- Any change to page content, backgrounds (MFC watermark stays), or auth logic.

## Testing

- `components/dashboard/Sidebar.test.tsx` (update):
  - Existing three tests keep passing (accessible names come from the fly-out spans).
  - New: active state — mock `next/navigation`'s `usePathname` to `/profile`, assert
    the Profile link has the active styling marker (e.g. `aria-current="page"`).
    Use `aria-current="page"` on the active link — semantic and easy to assert.
- `components/dashboard/Navbar.test.tsx` (new):
  - Renders brand text "OUTSLIP VMS".
  - Mock `usePathname` per test: `/dashboard` shows "Dashboard"; an unknown path
    (e.g. `/nowhere`) shows no page title.
  - Shows initials in the avatar and full name via `title` attribute.
- Full suite (`npm test`) green before commit.

## Implementation notes

- Both components stay in `components/dashboard/`; no new files beyond
  `Navbar.test.tsx`.
- Session payload already carries `firstName`/`lastName` (used by the layout) — no
  API or schema changes.
- Colors reuse the established palette: `#2C7001` (primary green), `red-600` for
  logout, `#6a7a66` muted icon gray-green.
