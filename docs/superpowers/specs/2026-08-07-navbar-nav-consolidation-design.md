# Navbar Nav Consolidation — Design

## Background

Follow-up to the Deep Forest redesign and the navbar floating-pill/logo update (same session). User referenced skynexalabs.xyz's navbar again: unlike this app, SkyNexa has no separate sidebar — its primary navigation (Home, About Us, Services, Blog, Company) lives entirely in the top nav bar. User asked for the same consolidation here: retire the floating icon-rail Sidebar, move its navigation (Dashboard, Profile, Settings, Register User) into the top Navbar as horizontal tabs.

Brainstormed via `superpowers:brainstorming` with the visual companion (session `463-1786085582`, port 52903, `navbar-with-tabs.html`) — one mockup showing the full desktop layout (logo → tabs → search/QR → avatar) with a working click-to-open Logout dropdown on the avatar. Approved as shown, with "Dashboard" renamed to "Home" (matching SkyNexa's own naming) and confirmed Logout should fold into an avatar-click dropdown rather than staying a rail item or becoming a nav-bar button.

## Scope

**Desktop only.** Mobile (<768px) is unchanged — the hamburger button already opens `MobileDrawer`, which is and remains the complete mobile navigation (including its own Logout button). This change retires the desktop-width `Sidebar` rail and folds its role into the desktop row of `Navbar`.

## Design

**Navbar desktop row, new layout (left to right):** MFC logo → nav tabs (`Home` / `Profile` / `Settings` / `Register User`, the last one conditional on `canProvisionUsers`, same as today's Sidebar/MobileDrawer gate) → page-title text (only for routes with no tab of their own — see below) → search bar → QR button → avatar with a click-to-open Logout dropdown.

**Nav tabs:** icon + label, pill-shaped, matching the existing active-state treatment already used elsewhere (gradient `from-[#3a9d0a] to-[#245c01]` fill + glow when active, muted `#9db894` text otherwise, hover brightens to `#eafbe4`). Active state via `pathname?.startsWith(href)`, identical logic to the retiring `RailLink`/`DrawerLink`. Icons reused as-is from `components/dashboard/icons.tsx` (`HomeIcon`, `UserIcon`, `SettingsIcon`, `UserPlusIcon`) — no new icons needed. The tabs sit inside their own `<nav>` element (semantic, and keeps `AppShell.test.tsx`'s `getByRole("navigation")` assertion valid without changes).

**Page-title text:** `PAGE_TITLES` shrinks from 8 entries to the 4 that have no corresponding tab — the transaction sub-pages (`/transactions/open`, `/transactions/approved`, `/transactions/canceled`, `/transactions/my-approvals`). For `/dashboard`, `/profile`, `/settings`, `/register`, the active tab's own highlight already communicates location, so showing the title too would be redundant — those four are simply removed from the map, and the existing `{title && (...)}` conditional naturally stops rendering for them.

**Logout dropdown:** clicking the avatar toggles a small absolutely-positioned dark-glass panel below it, containing the existing Logout `<form action="/api/auth/logout" method="post">` unchanged (same POST mechanism already working — this is a placement change, not a behavior change). Closes on: clicking the avatar again, clicking anywhere outside the panel, or Escape. Avatar button gains `aria-expanded` to reflect open/closed state. Not implemented as a full ARIA `menu`/`menuitem` pattern (no keyboard arrow-navigation) — YAGNI for a single-item menu; a plain popover with click-outside/Escape handling is enough, matching the escape-key convention `MobileDrawer` already uses.

**Retiring `Sidebar`:** `components/dashboard/Sidebar.tsx` and `Sidebar.test.tsx` are deleted outright — nothing else imports `Sidebar` (confirmed via grep) besides `AppShell.tsx`, which stops rendering it. `AppShell`'s layout simplifies: `Navbar` gains a `canProvisionUsers` prop (previously only `Sidebar`/`MobileDrawer` needed it) so it can conditionally show the Register User tab; the `<div className="flex flex-1">` wrapper that used to hold `Sidebar` + `MobileDrawer` + `main` side-by-side is no longer needed once `Sidebar` is gone (`MobileDrawer` is an overlay that renders `null` when closed, so it doesn't need to be a flex sibling of `main`) — `main` becomes a direct child of the outer column flex container.

**Test coverage:** `Sidebar.test.tsx`'s assertions (tabs present, Register User gated, active-state via `aria-current`) move into `Navbar.test.tsx` against the new desktop tabs, plus new cases for the Logout dropdown (closed by default, opens on avatar click, contains the Logout form, closes on outside click and Escape). `AppShell.test.tsx` needs no assertion changes — `getByRole("navigation")` and the mobile-drawer test both keep working against the new structure unchanged.

## Out of scope

Any change to `MobileDrawer.tsx` itself, or to mobile-width behavior generally. Any change to the actual `/api/auth/logout` route or session logic — only where the trigger button lives changes.
