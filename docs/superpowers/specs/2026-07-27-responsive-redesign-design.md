# Responsive Redesign (App Shell + Data Tables) — Design

**Date:** 2026-07-27
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, visual companion mockups for the table and mobile-nav decisions)

## Goal

The app currently has almost no responsive handling below desktop width — confirmed by grep, only `components/dashboard/ModuleGrid.tsx` and `app/(authenticated)/settings/SettingsView.tsx` use any `sm:`/`md:`/`lg:` breakpoint in the whole codebase (this matches the deferred audit already recorded in the branch handoff, §3v). This round makes the authenticated app usable on phone and tablet widths: a responsive app shell (navbar + nav), two data tables converted from flat wide tables to expandable rows, and a verification/fix pass over the remaining simpler pages.

## Scope

- **In scope:** `components/dashboard/Navbar.tsx`, `components/dashboard/Sidebar.tsx` (+ two new components), the Open Transactions table, the Register Users table, and a check-and-fix pass over Dashboard/Profile/Settings/Login/Change-password.
- **Out of scope:** any change to the *desktop* (`md:` and up) visual design already established on this branch — the goal is added responsiveness, not a redesign. Also out of scope: wiring the navbar's search input or QR-scan button to real functionality — both are still decorative placeholders (per the branch handoff, §3j) and this round doesn't change that.
- **Breakpoint:** Tailwind's default `md` (768px) is the single switch point used everywhere in this design. Below `md` = phone treatment (hamburger drawer, collapsed navbar). `md` and up = today's desktop layout (icon rail, full navbar), with one small addition for tablets specifically (see §1).

## 1. App shell (Navbar + Sidebar)

### Architecture

Today `app/(authenticated)/layout.tsx` (a server component) renders `<Navbar>` and `<Sidebar>` directly as siblings — there's no shared client state between them, which is a problem because the new hamburger button lives in `Navbar` but must control a drawer that is logically part of `Sidebar`'s replacement.

New client component **`components/dashboard/AppShell.tsx`** takes over that composition:

```tsx
"use client";
export function AppShell({ initials, fullName, canProvisionUsers, children }: {...}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-[#eef1ee]">
      <Navbar initials={initials} fullName={fullName} onMenuClick={() => setDrawerOpen(true)} />
      <div className="flex flex-1">
        <Sidebar canProvisionUsers={canProvisionUsers} />
        <MobileDrawer canProvisionUsers={canProvisionUsers} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
```

`layout.tsx` keeps its server-side session lookup and `redirect("/login")` guard exactly as today, but renders `<AppShell initials={...} fullName={...} canProvisionUsers={...}>{children}</AppShell>` instead of `<Navbar>`/`<Sidebar>` directly.

New file **`components/dashboard/icons.tsx`**: extract `HomeIcon`, `UserIcon`, `SettingsIcon`, `UserPlusIcon`, `LogOutIcon` out of `Sidebar.tsx` (unchanged SVGs) so both `Sidebar.tsx` and the new `MobileDrawer.tsx` can import them without duplicating five icon components. `CloseIcon` and the new hamburger icon are NOT extracted — every existing modal in this codebase defines its own local `CloseIcon`, so a new shared one would be an inconsistent one-off abstraction; keep following that precedent.

### Sidebar.tsx changes

- Root `<nav>` gains `hidden md:flex` (it's currently always `flex`) — the rail only renders at `md` and up now; below that, `MobileDrawer` is the nav.
- Icon imports switch to the new `icons.tsx` (no visual change).
- Tablet touch-label fix: add a new rule to `globals.css` — `@media (hover: none) { .rail-flyout { opacity: 1; transform: translateX(0); } }` (or equivalent, matching the existing flyout class's actual transform/opacity properties) so devices with no hover capability (touch tablets) show the label statically instead of relying on `:hover`/`:focus-visible`, which touch doesn't reliably trigger. Give the flyout `<span>` this class alongside its existing Tailwind classes. Mouse/trackpad devices at `md`+ are unaffected — they still get the existing hover/focus-visible fly-out behavior.

### Navbar.tsx changes

New prop: `onMenuClick: () => void`.

Two parallel markup blocks, switched purely by Tailwind display classes (no JS-side media query, no hydration risk):

- **Desktop/tablet (`hidden md:grid`)** — today's exact `grid-cols-[auto_1fr_auto]` row, unchanged.
- **Mobile (`flex md:hidden`)** — a new row:
  - Default state: **hamburger icon** (calls `onMenuClick`) → `{title ?? "OUTSLIP VMS"}` (truncated, single text, no divider — there isn't room for both brand and title on a 375px row) → **search icon** button → **QR icon** button (the existing SVG, unchanged) → avatar circle.
  - Tapping the search icon sets local `mobileSearchOpen` state to `true`, swapping the row to: a **cancel/X icon** (sets state back to `false`) → the existing search `<input>` (full width) → the QR icon (kept, same position as desktop's pairing). Avatar is dropped from this row to fit — cancel first to get it back.
- New local `MenuIcon` function (hamburger, 3 horizontal lines), same inline-SVG convention as every other icon in this codebase (`aria-hidden`, `viewBox="0 0 24 24"`, stroke-based).
- If this pushes `Navbar.tsx` uncomfortably large, splitting the mobile row into a small subcomponent is fine — not mandated up front.

### MobileDrawer.tsx (new)

Client component. Props: `canProvisionUsers: boolean`, `open: boolean`, `onClose: () => void`.

- Conditionally rendered only `{open && (...)}`, matching every other modal/dialog convention in this codebase (`role="dialog"`, `aria-modal="true"`).
- **Closes on backdrop click, Escape, or an explicit X** — confirmed by the user as the one deliberate exception to this branch's "X-only" modal convention, because a nav drawer is a standard mobile pattern with no data-entry risk (unlike every prior modal here, which is a form).
  - Backdrop click: `onClick={onClose}` on the outer overlay `div`; the drawer panel itself gets `onClick={(e) => e.stopPropagation()}` so taps inside it don't close it.
  - Escape: a `useEffect` that attaches a `keydown` listener on `document` only while `open`, calling `onClose()` on `"Escape"`, cleaned up on close/unmount.
- Panel slides in from the left over a dimmed backdrop (`bg-slate-900/35`, matching every other overlay in this app). New CSS keyframe in `globals.css`, e.g. `drawer-slide-in` (translateX from `-100%` to `0`), disabled under `prefers-reduced-motion: reduce` — same convention as the existing `toast-fade-in`/`login-card-in` animations.
- Content: brand text + an X close button in a small header row, then the same nav items as `Sidebar.tsx` in the same order (Dashboard, Profile, Settings, Register User if `canProvisionUsers`), each showing icon **and label** (unlike the rail, labels are always visible here — that's the point of a drawer), then Logout pinned below a divider at the bottom, reusing the existing `<form action="/api/auth/logout" method="post">` unchanged.
- **Each nav link's `onClick` also calls `onClose()`** (in addition to normal navigation) so the drawer doesn't stay open after the route changes. Logout doesn't need this — its form POST triggers a `303` redirect that navigates away and unmounts the whole layout.
- Only rendered/relevant below `md` — the component itself doesn't need a responsive class since `AppShell` only opens it via the hamburger button, which itself only exists in the `md:hidden` navbar row.

## 2. Open Transactions table — expandable rows

(This is the layout approved via mockup earlier in this session.)

`app/(authenticated)/transactions/open/TransactionsView.tsx`'s `TransactionsTable`:

- **Core columns, always shown:** QR, Code, Transaction Type, Created By, Status, Date Filed (6, down from 17).
- Each data row becomes clickable (`onClick` toggles that row's expanded state, tracked via `useState<Set<string>>` of expanded transaction codes, or a single `expandedCode: string | null` — either works, implementer's call) with a chevron indicator in a new leading column that rotates open/closed.
- Expanding a row reveals a detail panel (a single `<tr>` with one `colSpan`-ed `<td>`, matching the existing "no open transactions yet" empty-state pattern already in this file) showing that row's **populated** fields only, in a compact label/value grid — skip any field that would render as `"—"` rather than showing the dash in the expanded view.
- The fields available for the expanded panel are exactly today's 12 non-core columns: Planned Date, Planned Time, Return Time, Origin Business Unit, Enroute to Other Business Unit, Reason, Visitor Type, Person to Meet, Department, Location, Transport Type, Plate No.
- **Interaction fix (real, would otherwise be a bug):** the QR thumbnail button lives inside the row's own clickable area (it's one of the 6 core columns). Its `onClick` must call `event.stopPropagation()` so clicking the QR thumbnail opens the QR-enlarge dialog *without also* toggling the row's expand/collapse.
- The existing QR-enlarge dialog and Add Transaction modal are unchanged by this task.
- `overflow-x-auto` on the table wrapper can stay as a defensive fallback but should no longer be load-bearing at any reasonable width once the column count drops to 6.

## 3. Register Users table — same pattern

`app/(authenticated)/register/UsersView.tsx`:

- **Core columns:** First Name, Last Name, Role, Actions (4, down from 9).
- **Expand panel fields:** Job Title, Department, Business Unit, Location, Created.
- Same chevron/expand mechanism as the Open Transactions table (for consistency, not code sharing — these are two separate table components on this branch already, per established convention of not forcing premature shared abstractions across `*View.tsx` components).
- **Same interaction fix applies:** the Edit button lives in the Actions core column, inside the row's clickable area. Its `onClick` must call `event.stopPropagation()` so clicking Edit opens the edit modal without also toggling row expand/collapse.
- The Add/Edit User modal (`RegistrationWizard`) is unchanged.

## 4. Verification & fix pass (no redesign)

Check each of these at phone (375px) and tablet (768px) widths — via the running dev server and Playwright, same technique already used for prior live-verification on this branch — and fix concrete, observed problems only (no speculative changes):

- **`components/dashboard/ModuleGrid.tsx`** — already has `sm:grid-cols-2`; confirm it still looks reasonable at exactly 375px and at 768px (tablet may want a 3rd column at a wider breakpoint — only add one if the 2-column layout actually looks sparse at 768px in practice).
- **`app/(authenticated)/profile/ProfileView.tsx`** — one concrete, already-identified issue: the details grid is a flat `grid-cols-2` (`ProfileView.tsx:80`) with no mobile collapse. Change to `grid-cols-1 sm:grid-cols-2`. Also check the banner (name/role pill next to the absolutely-positioned "Change Password" link) doesn't clip or overlap at 375px.
- **`app/(authenticated)/settings/SettingsView.tsx`** — already has some responsive handling; confirm the 4-tile launcher and the Matrix Type Approver detail view (filter pills, table, Add Approver modal) hold up at both widths.
- **`app/login/LoginForm.tsx` / `app/login/page.tsx`, `app/change-password/ChangePasswordForm.tsx` / `page.tsx`** — centered-card layouts; confirm the card, toasts, and (on change-password) the two password-toggle fields don't clip at 375px. These are expected to need little or no change given the existing `max-w` centered-card pattern.

Any other concrete issue found during this pass (not anticipated here) gets fixed as part of this same task, scoped to responsive-only changes — not an invitation to redesign anything.

## Testing

- `Navbar.test.tsx` — extended for the new `onMenuClick` prop and the mobile search-toggle behavior (icon → input → cancel).
- New `MobileDrawer.test.tsx` — renders when open, hidden when not; backdrop click / Escape / X all close it; nav links call `onClose`; `canProvisionUsers` gates the Register User item, matching `Sidebar.test.tsx`'s existing coverage of the same gate.
- `Sidebar.test.tsx` — unaffected behaviorally (same links, same active-state logic), just confirm the `hidden md:flex` class is present.
- `TransactionsView.test.tsx` — extended: default view shows only the 6 core columns; clicking a row reveals its populated detail fields and hides `"—"`-only ones; clicking the QR thumbnail does not also expand the row.
- `UsersView.test.tsx` — same shape: 4 core columns by default, row click reveals detail fields, clicking Edit does not also expand the row.
- Verification-pass items get a regression test only where a real bug is fixed (e.g. the Profile grid collapse can be asserted via a snapshot of the class name or a viewport-based RTL check, implementer's call) — no test is required for "confirmed already fine."

## Out of scope

- Wiring the navbar search / QR-scan button to real functionality (still placeholders, per branch handoff §3j).
- Any visual change to the desktop (`md:` and up) layout beyond the tablet-only touch-label fix in §1.
- A shared `ExpandableTable` abstraction across the two tables — two separate, independently-readable components, matching this branch's established preference for concrete over premature abstraction.
- Hamburger drawer / bottom-tab alternatives (Options B and C from the mockup) — Option A was chosen.
- Column-visibility pickers, sticky columns, or any other table-scroll mitigation — superseded by the expandable-row approach for both tables.
