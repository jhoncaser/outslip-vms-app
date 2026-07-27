# Responsive Redesign (App Shell + Tables) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated app usable on phone and tablet widths: a hamburger-drawer mobile nav replacing today's desktop-only icon rail + full navbar, expandable-row redesigns for the Open Transactions and Register Users tables (currently 17 and 9 flat columns respectively), and a fix pass over the remaining simpler pages.

**Architecture:** A new client component (`AppShell`) takes over composing `Navbar`/`Sidebar`/a new `MobileDrawer`, since the hamburger trigger (in `Navbar`) and the drawer it opens are visually separate components that need shared open/closed state. `Navbar` and `Sidebar` each grow a second, CSS-only responsive layout (no JS media queries) alongside their existing desktop markup. The two tables get an identical UI pattern — collapse from many always-visible columns to a handful of core columns plus a click-to-expand detail panel — implemented independently in each `*View.tsx` (no shared abstraction, matching this codebase's existing per-component convention).

**Tech Stack:** Next.js 16 App Router (server + client components), Tailwind CSS v4, Vitest + Testing Library.

## Global Constraints

- **Single breakpoint: Tailwind's `md` (768px).** Below `md` = phone treatment (hamburger drawer, collapsed navbar). `md` and up = today's desktop layout, unchanged except for one tablet-only fix (rail flyout labels, Task 1).
- **No change to any desktop (`md:` and up) visual design** beyond that one tablet fix — this round adds responsiveness, it does not redesign the desktop experience.
- **The mobile drawer closes on backdrop click, Escape, or an explicit X** — confirmed by the user as a deliberate exception to this app's usual "X-only" modal convention (every prior modal — QR view, Add Transaction, Register/Edit User, Matrix Type Approver — is X-only; a nav drawer is different because it's pure navigation with no data-entry risk).
- **Open Transactions table core columns, exact order:** QR, Code, Transaction Type, Created By, Status, Date Filed. Everything else (Planned Date, Planned Time, Return Time, Origin Business Unit, Enroute to Other Business Unit, Reason, Visitor Type, Person to Meet, Department, Location, Transport Type, Plate No.) moves into a per-row expand panel, populated fields only (`"—"` placeholders are skipped, not shown, in the expanded view).
- **Register Users table core columns, exact order:** First Name, Last Name, Role, Actions. Everything else (Job Title, Department, Business Unit, Location, Created) moves into the expand panel.
- **Clicking a row's action button (QR thumbnail / Edit) must not also toggle that row's expand/collapse** — both buttons live inside the row's clickable area, so their `onClick` must call `event.stopPropagation()`.
- **No wiring of the navbar search input or QR-scan button to real functionality** — both stay decorative placeholders, unchanged from today.
- **No shared `ExpandableTable` abstraction** — the two tables are separate, independently-readable components; duplication between them is acceptable and matches this codebase's existing pattern of not sharing structure across the `*View.tsx` components.

---

### Task 1: Shared nav icons + Sidebar responsive treatment

**Files:**
- Create: `components/dashboard/icons.tsx`
- Modify: `components/dashboard/Sidebar.tsx`
- Modify: `components/dashboard/Sidebar.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (consumed by Task 2): `components/dashboard/icons.tsx` exports `HomeIcon`, `UserIcon`, `SettingsIcon`, `UserPlusIcon`, `LogOutIcon` — each a zero-prop function component, identical SVG markup to what's in `Sidebar.tsx` today.

- [ ] **Step 1: Create the shared icons file**

Create `components/dashboard/icons.tsx`:

```tsx
export function HomeIcon() {
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
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function UserIcon() {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function SettingsIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function UserPlusIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

export function LogOutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
```

- [ ] **Step 2: Update Sidebar.tsx to import icons and add the responsive/touch-label changes**

Replace the full contents of `components/dashboard/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
} from "./icons";

const itemClass =
  "group relative flex h-11 w-[46px] items-center justify-center rounded-xl text-[#6a7a66] transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none";

const greenItemClass = `${itemClass} hover:bg-[#2C7001] hover:text-white focus-visible:bg-[#2C7001] focus-visible:text-white`;

const flyoutClass =
  "rail-flyout pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-x-2 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold text-white opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none z-50";

const greenFlyoutClass = `${flyoutClass} bg-[#2C7001] shadow-[0_6px_16px_rgba(44,112,1,0.3)]`;

function RailLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href) ?? false;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `${itemClass} bg-[#2C7001] text-white shadow-[0_6px_14px_rgba(44,112,1,0.35)]`
          : greenItemClass
      }
    >
      {icon}
      <span className={greenFlyoutClass}>{label}</span>
    </Link>
  );
}

export function Sidebar({
  canProvisionUsers,
}: {
  canProvisionUsers: boolean;
}) {
  return (
    <nav className="relative z-20 my-4 ml-4 hidden w-[68px] flex-shrink-0 flex-col items-center rounded-2xl bg-white py-3 shadow-[0_4px_24px_rgba(20,45,8,0.10)] md:flex">
      <div className="flex flex-col items-center gap-1.5">
        <RailLink href="/dashboard" label="Dashboard" icon={<HomeIcon />} />
        <RailLink href="/profile" label="Profile" icon={<UserIcon />} />
        <RailLink href="/settings" label="Settings" icon={<SettingsIcon />} />
        {canProvisionUsers && (
          <RailLink
            href="/register"
            label="Register User"
            icon={<UserPlusIcon />}
          />
        )}
      </div>
      <form
        action="/api/auth/logout"
        method="post"
        className="mt-auto flex w-full justify-center border-t border-[#eef1ec] pt-2.5"
      >
        <button
          type="submit"
          className={`${itemClass} hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white`}
        >
          <LogOutIcon />
          <span
            className={`${flyoutClass} bg-red-600 shadow-[0_6px_16px_rgba(220,38,38,0.3)]`}
          >
            Logout
          </span>
        </button>
      </form>
    </nav>
  );
}
```

Only two functional changes from today: the root `<nav>` className changed `flex` → `hidden ... md:flex` (rail only renders at tablet width and up now), and both flyout classes gained a leading `rail-flyout` literal class name (used by the new CSS rule in Step 3 — everything else is byte-identical to today).

- [ ] **Step 3: Add the tablet touch-label CSS override**

In `app/globals.css`, add this block after the existing `toast-fade-in` rules (end of file):

```css
@media (hover: none) {
  .rail-flyout {
    opacity: 1 !important;
    transform: translate(0, -50%) !important;
  }
}
```

This targets devices with no hover capability (touch tablets, since the rail only renders at `md:` and up) and forces the flyout label statically visible instead of relying on `:hover`/`:focus-visible`, which touch doesn't reliably trigger. `!important` is deliberate here — Tailwind v4 composes `-translate-x-2`/`-translate-y-1/2` into `transform` via internal CSS custom properties, and this override needs to win unconditionally under the `(hover: none)` condition without needing to reverse-engineer Tailwind's internal variable names. `translate(0, -50%)` reproduces the icon-centered vertical position (`-translate-y-1/2`) while zeroing the horizontal offset (the flyout's "slide in from the icon" animation, which doesn't apply once it's statically shown).

- [ ] **Step 4: Update Sidebar.test.tsx**

Replace the full contents of `components/dashboard/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Sidebar } from "./Sidebar";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

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

  it("marks the current page's link with aria-current", () => {
    pathnameRef.current = "/profile";
    render(<Sidebar canProvisionUsers={false} />);
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("only renders at tablet width and up (hidden below md)", () => {
    render(<Sidebar canProvisionUsers={false} />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
  });
});
```

(Only the last test is new; everything above it is unchanged from today.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/dashboard/Sidebar.test.tsx`
Expected: PASS — 5/5.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/icons.tsx components/dashboard/Sidebar.tsx components/dashboard/Sidebar.test.tsx app/globals.css
git commit -m "Extract shared nav icons, make Sidebar tablet-and-up only"
```

---

### Task 2: MobileDrawer component

**Files:**
- Create: `components/dashboard/MobileDrawer.tsx`
- Create: `components/dashboard/MobileDrawer.test.tsx`

**Interfaces:**
- Consumes: `HomeIcon`, `UserIcon`, `SettingsIcon`, `UserPlusIcon`, `LogOutIcon` from `components/dashboard/icons.tsx` (Task 1). New CSS class `drawer-slide-in` (this task adds it to `app/globals.css`).
- Produces (consumed by Task 4): `MobileDrawer` component, props `{ canProvisionUsers: boolean; open: boolean; onClose: () => void }`.

- [ ] **Step 1: Add the drawer slide-in animation**

In `app/globals.css`, add this block after the `(hover: none)` rule added in Task 1:

```css
@keyframes drawer-slide-in {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-slide-in {
  animation: drawer-slide-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .drawer-slide-in {
    animation: none;
  }
}
```

(Same convention as the existing `login-card-in`/`toast-fade-in` blocks already in this file.)

- [ ] **Step 2: Create MobileDrawer.tsx**

Create `components/dashboard/MobileDrawer.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
} from "./icons";

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

function DrawerLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href) ?? false;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-[#2C7001] text-white" : "text-[#3f4a3d] hover:bg-[#eef1ec]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function MobileDrawer({
  canProvisionUsers,
  open,
  onClose,
}: {
  canProvisionUsers: boolean;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/35 md:hidden"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="drawer-slide-in flex h-full w-[260px] flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#eef1ec] px-4 py-3.5">
          <span className="text-sm font-bold tracking-wide text-[#2C7001]">
            OUTSLIP VMS
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <DrawerLink
            href="/dashboard"
            label="Dashboard"
            icon={<HomeIcon />}
            onNavigate={onClose}
          />
          <DrawerLink
            href="/profile"
            label="Profile"
            icon={<UserIcon />}
            onNavigate={onClose}
          />
          <DrawerLink
            href="/settings"
            label="Settings"
            icon={<SettingsIcon />}
            onNavigate={onClose}
          />
          {canProvisionUsers && (
            <DrawerLink
              href="/register"
              label="Register User"
              icon={<UserPlusIcon />}
              onNavigate={onClose}
            />
          )}
        </nav>

        <form
          action="/api/auth/logout"
          method="post"
          className="border-t border-[#eef1ec] p-3"
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOutIcon />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
```

Key behaviors: conditionally rendered (`if (!open) return null`, matching every other modal in this codebase); backdrop `onClick={onClose}` with the inner panel's `onClick` calling `event.stopPropagation()` so taps inside don't close it; Escape closes via a `document`-level listener attached only while `open`; each `DrawerLink`'s `onClick` calls `onNavigate` (which is `onClose`) so the drawer doesn't stay open after navigating; `md:hidden` on the outer overlay is a defensive guard in case the drawer is left open while the viewport grows past `md` (e.g. window resize).

- [ ] **Step 3: Create MobileDrawer.test.tsx**

Create `components/dashboard/MobileDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileDrawer } from "./MobileDrawer";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

// A plain anchor stand-in avoids depending on Next's router-context
// internals for a click-driven unit test — production code still uses the
// real next/link Link, this mock only applies within this test file.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

describe("MobileDrawer", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders nothing when closed", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={false} onClose={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows Dashboard, Profile, Settings, and Logout when open", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /logout/i })
    ).toBeInTheDocument();
  });

  it("hides Register User when canProvisionUsers is false", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.queryByRole("link", { name: /register user/i })
    ).not.toBeInTheDocument();
  });

  it("shows Register User when canProvisionUsers is true", () => {
    render(
      <MobileDrawer canProvisionUsers={true} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole("link", { name: /register user/i })
    ).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the drawer panel", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("OUTSLIP VMS"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("link", { name: /profile/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks the current page's link with aria-current", () => {
    pathnameRef.current = "/profile";
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/dashboard/MobileDrawer.test.tsx`
Expected: PASS — 9/9.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/MobileDrawer.tsx components/dashboard/MobileDrawer.test.tsx app/globals.css
git commit -m "Add MobileDrawer component for mobile navigation"
```

---

### Task 3: Navbar responsive layout (hamburger + collapsible mobile search)

**Files:**
- Modify: `components/dashboard/Navbar.tsx`
- Modify: `components/dashboard/Navbar.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (consumed by Task 4): `Navbar` requires a new prop `onMenuClick: () => void`. Root renders two sibling blocks tagged `data-testid="navbar-desktop"` (`hidden md:grid`) and `data-testid="navbar-mobile"` (`flex md:hidden`) — both are always present in the DOM (Tailwind's responsive display classes are CSS-only; jsdom doesn't evaluate media queries), so any test must scope queries with `within(...)` to whichever block it means, since accessible names collide between the two by design (e.g. both blocks have a "Scan QR code" button).

- [ ] **Step 1: Replace Navbar.tsx**

Replace the full contents of `components/dashboard/Navbar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Profile",
  "/settings": "Settings",
  "/register": "Register User",
  "/transactions/open": "Open Transaction",
  "/transactions/approved": "Approved Transaction",
  "/transactions/canceled": "Canceled Transaction",
  "/transactions/my-approvals": "My Approvals",
};

function MenuIcon() {
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
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M21 18v3h-3" />
    </svg>
  );
}

function CancelIcon() {
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

export function Navbar({
  initials,
  fullName,
  onMenuClick,
}: {
  initials: string;
  fullName: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = pathname ? PAGE_TITLES[pathname] : undefined;
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="bg-[#2C7001] px-4 py-3 text-white sm:px-6">
      <div
        data-testid="navbar-desktop"
        className="hidden grid-cols-[auto_1fr_auto] items-center gap-6 md:grid"
      >
        <div className="flex items-center gap-3.5">
          <span className="text-sm font-bold tracking-wide">OUTSLIP VMS</span>
          {title && (
            <>
              <span aria-hidden className="h-[22px] w-px bg-white/30" />
              <span className="whitespace-nowrap text-[13px] font-semibold text-white/90">
                {title}
              </span>
            </>
          )}
        </div>
        <div className="flex justify-center">
          <div className="relative w-full max-w-3xl">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2C7001]/60">
              <SearchIcon />
            </span>
            <input
              type="search"
              aria-label="Search transaction code"
              placeholder="Search..."
              className="w-full rounded-full border-0 bg-white py-1.5 pl-9 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
            />
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="absolute right-1.5 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full text-[#2C7001] hover:bg-[#2C7001]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C7001]/50"
            >
              <QrIcon />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <span
            title={fullName}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-xs font-bold"
          >
            {initials}
          </span>
        </div>
      </div>

      <div
        data-testid="navbar-mobile"
        className="flex items-center gap-3 md:hidden"
      >
        {mobileSearchOpen ? (
          <>
            <button
              type="button"
              aria-label="Cancel search"
              onClick={() => setMobileSearchOpen(false)}
              className="shrink-0 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <CancelIcon />
            </button>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2C7001]/60">
                <SearchIcon />
              </span>
              <input
                type="search"
                aria-label="Search transaction code"
                placeholder="Search..."
                autoFocus
                className="w-full rounded-full border-0 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
              />
            </div>
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="shrink-0 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <QrIcon />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={onMenuClick}
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <MenuIcon />
            </button>
            <span className="flex-1 truncate text-sm font-semibold">
              {title ?? "OUTSLIP VMS"}
            </span>
            <button
              type="button"
              aria-label="Search transaction code"
              onClick={() => setMobileSearchOpen(true)}
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <QrIcon />
            </button>
            <span
              title={fullName}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold"
            >
              {initials}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
```

Mobile row default state: hamburger → page title (or brand as fallback, single text — there isn't room for both brand and title on a 375px row) → search icon button → QR icon button → avatar. Tapping the search icon swaps to: cancel icon → full-width input → QR icon (avatar is dropped from this row to fit; cancel first to get it back). The search `<input>` in the mobile row only exists in the DOM once `mobileSearchOpen` is `true` — it is not merely CSS-hidden — which is what keeps the *default* render free of a duplicate `searchbox` alongside the desktop block's.

- [ ] **Step 2: Replace Navbar.test.tsx**

Replace the full contents of `components/dashboard/Navbar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { Navbar } from "./Navbar";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("Navbar", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  function renderNavbar(onMenuClick = vi.fn()) {
    render(
      <Navbar initials="JC" fullName="Jhon Caser" onMenuClick={onMenuClick} />
    );
    return {
      desktop: screen.getByTestId("navbar-desktop"),
      mobile: screen.getByTestId("navbar-mobile"),
    };
  }

  it("shows the brand name", () => {
    const { desktop } = renderNavbar();
    expect(within(desktop).getByText("OUTSLIP VMS")).toBeInTheDocument();
  });

  it("shows the current page title", () => {
    pathnameRef.current = "/register";
    const { desktop } = renderNavbar();
    expect(within(desktop).getByText("Register User")).toBeInTheDocument();
  });

  it("shows no page title on an unknown path", () => {
    pathnameRef.current = "/nowhere";
    const { desktop } = renderNavbar();
    expect(within(desktop).queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows the user's initials with the full name as tooltip", () => {
    const { desktop } = renderNavbar();
    const avatar = within(desktop).getByText("JC");
    expect(avatar).toHaveAttribute("title", "Jhon Caser");
  });

  it("shows a transaction code search field", () => {
    const { desktop } = renderNavbar();
    const searchbox = within(desktop).getByRole("searchbox", {
      name: "Search transaction code",
    });
    expect(searchbox).toBeInTheDocument();
    expect(searchbox).toHaveAttribute("placeholder", "Search...");
  });

  it("shows a QR scan button inside the search bar", () => {
    const { desktop } = renderNavbar();
    expect(
      within(desktop).getByRole("button", { name: "Scan QR code" })
    ).toBeInTheDocument();
  });

  it("shows a hamburger menu button on the mobile row that calls onMenuClick", () => {
    const onMenuClick = vi.fn();
    const { mobile } = renderNavbar(onMenuClick);
    fireEvent.click(
      within(mobile).getByRole("button", { name: /open navigation menu/i })
    );
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("shows the page title on the mobile row", () => {
    pathnameRef.current = "/register";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByText("Register User")).toBeInTheDocument();
  });

  it("falls back to the brand name on the mobile row when there's no page title", () => {
    pathnameRef.current = "/nowhere";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByText("OUTSLIP VMS")).toBeInTheDocument();
  });

  it("expands a search input on the mobile row when the search icon is tapped, and collapses it back on cancel", () => {
    const { mobile } = renderNavbar();
    expect(within(mobile).queryByRole("searchbox")).not.toBeInTheDocument();

    fireEvent.click(
      within(mobile).getByRole("button", {
        name: /^search transaction code$/i,
      })
    );
    expect(
      within(mobile).getByRole("searchbox", {
        name: "Search transaction code",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      within(mobile).getByRole("button", { name: /cancel search/i })
    );
    expect(within(mobile).queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows a QR scan button on the mobile row too", () => {
    const { mobile } = renderNavbar();
    expect(
      within(mobile).getByRole("button", { name: "Scan QR code" })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run components/dashboard/Navbar.test.tsx`
Expected: PASS — 11/11.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/Navbar.tsx components/dashboard/Navbar.test.tsx
git commit -m "Add responsive mobile row and hamburger trigger to Navbar"
```

---

### Task 4: AppShell wiring + layout.tsx

**Files:**
- Create: `components/dashboard/AppShell.tsx`
- Create: `components/dashboard/AppShell.test.tsx`
- Modify: `app/(authenticated)/layout.tsx`

**Interfaces:**
- Consumes: `Navbar` (Task 3, requires `onMenuClick`), `Sidebar` (Task 1, unchanged props), `MobileDrawer` (Task 2, requires `{ canProvisionUsers, open, onClose }`).
- Produces: nothing consumed by a later task — this closes out the app-shell portion of the plan.

- [ ] **Step 1: Create AppShell.tsx**

Create `components/dashboard/AppShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";

export function AppShell({
  initials,
  fullName,
  canProvisionUsers,
  children,
}: {
  initials: string;
  fullName: string;
  canProvisionUsers: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#eef1ee]">
      <Navbar
        initials={initials}
        fullName={fullName}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <div className="flex flex-1">
        <Sidebar canProvisionUsers={canProvisionUsers} />
        <MobileDrawer
          canProvisionUsers={canProvisionUsers}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update layout.tsx to use AppShell**

Replace the full contents of `app/(authenticated)/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { AppShell } from "@/components/dashboard/AppShell";

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

  const initials =
    `${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase();
  const fullName = `${session.firstName} ${session.lastName}`;

  return (
    <AppShell
      initials={initials}
      fullName={fullName}
      canProvisionUsers={canProvisionUsers(session)}
    >
      {children}
    </AppShell>
  );
}
```

(Session lookup and the `redirect("/login")` guard are unchanged — only the returned JSX changed, from `<Navbar>`/`<Sidebar>` directly to `<AppShell>`.)

- [ ] **Step 3: Create AppShell.test.tsx**

Create `components/dashboard/AppShell.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AppShell } from "./AppShell";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("AppShell", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders the navbar, sidebar, and page content", () => {
    render(
      <AppShell initials="JC" fullName="Jhon Caser" canProvisionUsers={false}>
        <p>Page content</p>
      </AppShell>
    );
    expect(screen.getByTestId("navbar-desktop")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("opens the mobile drawer when the hamburger button is clicked, and closes it via its own Close button", () => {
    render(
      <AppShell initials="JC" fullName="Jhon Caser" canProvisionUsers={false}>
        <p>Page content</p>
      </AppShell>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("navbar-mobile")).getByRole("button", {
        name: /open navigation menu/i,
      })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS on every file except the known `prisma/seed.test.ts` baseline failures (seed-admin password, live-DB reference-data drift — pre-existing, unrelated). No other file should regress.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/AppShell.tsx components/dashboard/AppShell.test.tsx "app/(authenticated)/layout.tsx"
git commit -m "Wire Navbar, Sidebar, and MobileDrawer through a new AppShell"
```

---

### Task 5: Open Transactions table — expandable rows

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks — only the `TransactionsTable` function inside this file changes; `TransactionsView` (the modal/form logic) is untouched.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Replace the `TransactionsTable` function**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, change the import line at the top from:

```tsx
import { useState, type FormEvent } from "react";
```

to:

```tsx
import { Fragment, useState, type FormEvent } from "react";
```

Then delete the entire `TransactionsTable` function (from `function TransactionsTable({ rows }: { rows: TransactionRow[] }) {` through its matching closing `}` — everything up to, but not including, the `const inputClassName = ...` line that follows it), and insert the following in its place. The replacement is larger than what was deleted: it adds a new `DetailField` type and `transactionDetailFields` helper immediately before the redefined `TransactionsTable` function.

```tsx
type DetailField = { label: string; value: string };

function transactionDetailFields(row: TransactionRow): DetailField[] {
  const candidates: DetailField[] = [
    { label: "Planned Date", value: row.plannedDate },
    { label: "Planned Time", value: row.plannedTime },
    { label: "Return Time", value: row.returnTime },
    { label: "Origin Business Unit", value: row.originBusinessUnit },
    { label: "Enroute to Other Business Unit", value: row.enrouteBusinessUnits },
    { label: "Reason", value: row.reason },
    { label: "Visitor Type", value: row.visitorType },
    { label: "Person to Meet", value: row.personToMeet },
    { label: "Department", value: row.department },
    { label: "Location", value: row.location },
    { label: "Transport Type", value: row.transportType },
    { label: "Plate No.", value: row.plateNo },
  ];
  return candidates.filter((field) => field.value !== "—");
}

function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              <th className="w-9 px-2 py-3" aria-hidden="true" />
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-500">
                  No open transactions yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isExpanded = expandedCode === row.transactionCode;
                const detailFields = transactionDetailFields(row);
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedCode(isExpanded ? null : row.transactionCode)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedCode(isExpanded ? null : row.transactionCode);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      className={`cursor-pointer border-b border-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C7001]/40 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                    >
                      <td className="px-2 py-3 text-center text-slate-400">
                        <span
                          aria-hidden
                          className={`inline-block transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEnlargedCode(row.transactionCode);
                          }}
                          className="h-12 w-12 overflow-hidden rounded border border-slate-200 transition-colors hover:border-[#2C7001] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
                        >
                          <img
                            src={row.qrDataUrl}
                            alt={`QR code for transaction ${row.transactionCode}`}
                            className="h-full w-full"
                          />
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{row.transactionCode}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.matrixTypeName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.createdBy}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {row.statusName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.createdAt}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#fbfdf9]">
                        <td colSpan={columns.length + 1} className="px-4 py-0">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 pl-9 sm:grid-cols-3">
                            {detailFields.length === 0 ? (
                              <p className="col-span-full text-xs text-slate-400">
                                No additional details for this transaction.
                              </p>
                            ) : (
                              detailFields.map((field) => (
                                <div key={field.label}>
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    {field.label}
                                  </div>
                                  <div className="text-sm text-slate-700">{field.value}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {enlargedRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl">
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
                  id="qr-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {enlargedRow.transactionCode}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setEnlargedCode(null)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex justify-center px-8 py-7">
                <img
                  src={enlargedRow.qrDataUrl}
                  alt={`QR code for transaction ${enlargedRow.transactionCode}`}
                  className="h-56 w-56"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

The `CloseIcon` function above `TransactionsTable` and everything from `const inputClassName = ...` through the end of the file (the `TransactionsView` component: modal, form, all field logic) are **unchanged** — do not touch them.

Note the QR thumbnail button's `onClick` now calls `event.stopPropagation()` before `setEnlargedCode` — without it, clicking the thumbnail would also toggle the row's expand state, since the button lives inside the row's own `onClick` area.

- [ ] **Step 2: Replace TransactionsView.test.tsx**

Replace the full contents of `app/(authenticated)/transactions/open/TransactionsView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TransactionsView } from "./TransactionsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const transactions = [
  {
    id: "t1",
    transactionCode: "OT-001",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Halfday",
    plannedDate: "Jul 25, 2026",
    plannedTime: "9:00 AM",
    returnTime: "5:00 PM",
    originBusinessUnit: "Cawit",
    enrouteBusinessUnits: "Alpha, Delta",
    reason: "Client meeting",
    visitorType: "—",
    personToMeet: "—",
    department: "—",
    location: "—",
    transportType: "—",
    plateNo: "—",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
const visitorPassTransactions = [
  {
    id: "t2",
    transactionCode: "OT-002",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Visitor Pass",
    plannedDate: "Jul 26, 2026",
    plannedTime: "10:30 AM",
    returnTime: "—",
    originBusinessUnit: "—",
    enrouteBusinessUnits: "—",
    reason: "Product demo for a prospective supplier",
    visitorType: "Supplier",
    personToMeet: "Analyn Gentizon",
    department: "ICT",
    location: "Lobby, Room 204",
    transportType: "Car",
    plateNo: "ABC-1234",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 25, 2026",
  },
];
const matrixTypes = [
  { id: "mt1", name: "Halfday" },
  { id: "mt2", name: "Undertime" },
  { id: "mt3", name: "Visitor Pass" },
];
const departments = [
  { id: "d1", name: "ICT" },
  { id: "d2", name: "HR" },
];

function renderView(currentUserBusinessUnit = "") {
  return render(
    <TransactionsView
      transactions={transactions}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
      departments={departments}
    />
  );
}

function rowFor(code: string) {
  const cell = screen.getByText(code);
  const row = cell.closest("tr");
  if (!row) throw new Error(`No <tr> ancestor found for ${code}`);
  return row;
}

describe("TransactionsView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ id: "new1" }),
        })
      )
    );
  });

  it("renders the transactions table with the 6 core columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });

  it("does not show detail fields until a row is expanded", () => {
    renderView();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
    expect(screen.queryByText("Cawit")).not.toBeInTheDocument();
  });

  it("expands a row to reveal its populated detail fields, skipping dash-only ones, and collapses again on second click", () => {
    renderView();
    fireEvent.click(rowFor("OT-001"));

    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument(); // Planned Date
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Delta")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
    // Dash-only fields for this row must not appear in the expanded panel
    expect(screen.queryByText("Visitor Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Person to Meet")).not.toBeInTheDocument();

    fireEvent.click(rowFor("OT-001"));
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });

  it("expanding a Visitor Pass row shows its populated visitor fields and skips its dash-only generic fields", () => {
    render(
      <TransactionsView
        transactions={visitorPassTransactions}
        matrixTypes={matrixTypes}
        currentUserBusinessUnit=""
        departments={departments}
      />
    );
    fireEvent.click(rowFor("OT-002"));

    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Lobby, Room 204")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
    expect(screen.queryByText("Origin Business Unit")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Enroute to Other Business Unit")
    ).not.toBeInTheDocument();
  });

  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });

  it("opens an enlarged QR view when the thumbnail is clicked, and closes it via the X, without expanding the row", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the enlarged QR view open on backdrop click and Escape", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the modal and lists matrix type options", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Halfday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Undertime" })).toBeInTheDocument();
  });

  it("renders the additional optional fields in the Add Transaction modal", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /enroute to other business unit/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Delta" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
  });

  it("shows the Visitor Pass field set and hides Return Time, Origin Business Unit, and Enroute to Other Business Unit when Visitor Pass is selected", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt3" },
    });

    expect(screen.getByLabelText(/^visitor type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/person to meet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^transport type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plate no\./i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the default field set when a non-Visitor-Pass matrix type is selected", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("includes populated optional fields in the submitted body", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Client meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt1",
            plannedDate: "2026-07-25",
            reason: "Client meeting",
          }),
        })
      )
    );
  });

  it("submits populated Visitor Pass fields in the request body", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt3" },
    });
    fireEvent.change(screen.getByLabelText(/^visitor type$/i), {
      target: { value: "Supplier" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-26" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText(/person to meet/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "d1" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Product demo for a prospective supplier" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "Lobby, Room 204" },
    });
    fireEvent.change(screen.getByLabelText(/^transport type$/i), {
      target: { value: "Car" },
    });
    fireEvent.change(screen.getByLabelText(/plate no\./i), {
      target: { value: "ABC-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt3",
            plannedDate: "2026-07-26",
            plannedTime: "10:30",
            reason: "Product demo for a prospective supplier",
            visitorType: "Supplier",
            personToMeet: "Analyn Gentizon",
            departmentId: "d1",
            visitLocation: "Lobby, Room 204",
            transportType: "Car",
            plateNo: "ABC-1234",
          }),
        })
      )
    );
  });

  it("includes all checked values when submitting the Enroute to Other Business Unit checkboxes", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Delta" }));

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            '"enrouteBusinessUnits":["Alpha","Delta"]'
          ),
        })
      )
    );
  });

  it("submits the selected matrix type to /api/transactions", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2" }),
        })
      )
    );
  });

  it("pre-fills Origin Business Unit with the current user's business unit when it's a valid option", () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("Cawit");
  });

  it("still allows changing the pre-filled Origin Business Unit before submitting", async () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Delta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2", originBusinessUnit: "Delta" }),
        })
      )
    );
  });

  it("leaves Origin Business Unit unset when the current user's business unit isn't one of the fixed options", () => {
    renderView("MSC");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("");
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS — 19/19.

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Collapse Open Transactions table to core columns with expandable row detail"
```

---

### Task 6: Register Users table — expandable rows

**Files:**
- Modify: `app/(authenticated)/register/UsersView.tsx`
- Modify: `app/(authenticated)/register/UsersView.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Replace UsersView.tsx**

Replace the full contents of `app/(authenticated)/register/UsersView.tsx`:

```tsx
"use client";

import { Fragment, useState } from "react";
import { RegistrationWizard } from "./RegistrationWizard";
import { ROLE_LABELS, type RoleValue } from "@/lib/roles";

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: RoleValue;
  department: string;
  businessUnit: string;
  location: string;
  createdAt: string;
};

function EditIcon() {
  return (
    <svg
      aria-hidden
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const ROLE_PILL_CLASSES: Record<RoleValue, string> = {
  CREATOR: "bg-sky-100 text-sky-800",
  FIRST_APPROVER: "bg-amber-100 text-amber-800",
  SECOND_APPROVER: "bg-green-100 text-green-800",
  THIRD_APPROVER: "bg-indigo-100 text-indigo-800",
  GUARD_PERSONNEL: "bg-purple-100 text-purple-800",
};

const COLUMNS = ["First Name", "Last Name", "Role", "Actions"];

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; userId: string };

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
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
          onClick={() => setModal({ mode: "create" })}
          className="rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Register User
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              <th className="w-9 px-2 py-3" aria-hidden="true" />
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-xs font-bold text-white"
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
                  colSpan={COLUMNS.length + 1}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No users registered yet.
                </td>
              </tr>
            ) : (
              users.map((user, index) => {
                const isExpanded = expandedUserId === user.id;
                return (
                  <Fragment key={user.id}>
                    <tr
                      onClick={() =>
                        setExpandedUserId(isExpanded ? null : user.id)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedUserId(isExpanded ? null : user.id);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      className={`cursor-pointer border-b border-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C7001]/40 ${
                        index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"
                      }`}
                    >
                      <td className="px-2 py-3 text-center text-slate-400">
                        <span
                          aria-hidden
                          className={`inline-block transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.firstName}</td>
                      <td className="px-4 py-3">{user.lastName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_PILL_CLASSES[user.role]}`}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setModal({ mode: "edit", userId: user.id });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe3c4] bg-white px-2.5 py-1 text-xs font-semibold text-[#2C7001] transition-colors duration-150 hover:border-[#2C7001] hover:bg-[#f2f8ee] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none"
                        >
                          <EditIcon />
                          Edit
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#fbfdf9]">
                        <td colSpan={COLUMNS.length + 1} className="px-4 py-0">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 pl-9 sm:grid-cols-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Job Title
                              </div>
                              <div className="text-sm text-slate-700">{user.jobTitle}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Department
                              </div>
                              <div className="text-sm text-slate-700">{user.department}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Business Unit
                              </div>
                              <div className="text-sm text-slate-700">{user.businessUnit}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Location
                              </div>
                              <div className="text-sm text-slate-700">{user.location}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Created
                              </div>
                              <div className="text-sm text-slate-700">{user.createdAt}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal.mode !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-user-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
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
                <h2
                  id="register-user-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {modal.mode === "edit" ? "EDIT USER" : "REGISTER USER"}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModal({ mode: "closed" })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="px-8 py-7">
                <RegistrationWizard
                  userId={modal.mode === "edit" ? modal.userId : undefined}
                  onDone={() => setModal({ mode: "closed" })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace UsersView.test.tsx**

Replace the full contents of `app/(authenticated)/register/UsersView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UsersView, type UserRow } from "./UsersView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleUsers: UserRow[] = [
  {
    id: "u1",
    firstName: "Juan",
    lastName: "Dela Cruz",
    jobTitle: "IT Officer",
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
    jobTitle: "HR Manager",
    role: "FIRST_APPROVER",
    department: "Admin",
    businessUnit: "Corporate",
    location: "Navotas",
    createdAt: "Jul 19, 2026",
  },
];

function rowFor(firstName: string) {
  const cell = screen.getByText(firstName);
  const row = cell.closest("tr");
  if (!row) throw new Error(`No <tr> ancestor found for ${firstName}`);
  return row;
}

describe("UsersView", () => {
  beforeEach(() => {
    // The wizard inside the modal fetches reference data on mount, and in
    // edit mode also fetches the target user's details.
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
        if (url.startsWith("/api/users/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "u1",
              role: "CREATOR",
              firstName: "Juan",
              middleName: "",
              lastName: "Dela Cruz",
              jobTitle: "IT Officer",
              email: "juan@example.com",
              departmentId: "dept_1",
              businessUnitId: "bu_1",
              locationId: "loc_1",
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("renders the 4 core column headers", () => {
    render(<UsersView users={sampleUsers} />);
    for (const header of ["First Name", "Last Name", "Role", "Actions"]) {
      expect(
        screen.getByRole("columnheader", { name: header })
      ).toBeInTheDocument();
    }
  });

  it("renders user rows with names, role labels, and count", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("1st Level Approver")).toBeInTheDocument();
    expect(screen.getByText("2 users")).toBeInTheDocument();
  });

  it("does not show detail fields until a row is expanded", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.queryByText("IT Officer")).not.toBeInTheDocument();
    expect(screen.queryByText("Jul 18, 2026")).not.toBeInTheDocument();
  });

  it("expands a row to reveal Job Title, Department, Business Unit, Location, and Created, and collapses again on second click", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(rowFor("Juan"));

    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Zamboanga")).toBeInTheDocument();
    expect(screen.getByText("Jul 18, 2026")).toBeInTheDocument();

    fireEvent.click(rowFor("Juan"));
    expect(screen.queryByText("IT Officer")).not.toBeInTheDocument();
  });

  it("clicking Edit does not also expand the row", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("IT Officer")).not.toBeInTheDocument();
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

  it("keeps the modal open on backdrop click and Escape", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(
      screen.getByRole("button", { name: /\+ register user/i })
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("uses the singular label for exactly one user", () => {
    render(<UsersView users={[sampleUsers[0]]} />);
    expect(screen.getByText("1 user")).toBeInTheDocument();
  });

  it("renders an Edit button for each row", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.getAllByRole("button", { name: /^edit$/i })).toHaveLength(2);
  });

  it("opens the edit modal with an EDIT USER header and fetches that row's details", async () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/edit user/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/users/u1")
    );
  });

  it("still shows a REGISTER USER header for the create flow", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ register user/i }));
    expect(screen.getByText(/^register user$/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run "app/(authenticated)/register/UsersView.test.tsx"`
Expected: PASS — 12/12.

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/register/UsersView.tsx" "app/(authenticated)/register/UsersView.test.tsx"
git commit -m "Collapse Register Users table to core columns with expandable row detail"
```

---

### Task 7: Verification & fix pass over the remaining pages

**Files:**
- Modify: `app/(authenticated)/profile/ProfileView.tsx`
- Modify: `app/(authenticated)/profile/ProfileView.test.tsx`
- Verify only (fix if broken, otherwise no change): `components/dashboard/ModuleGrid.tsx`, `app/(authenticated)/settings/SettingsView.tsx`, `app/(authenticated)/settings/MatrixTypeApproverDetail.tsx`, `app/login/LoginForm.tsx`, `app/change-password/ChangePasswordForm.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (this task can run any time after Task 4, since it also re-verifies the app shell end-to-end in a real browser).
- Produces: nothing consumed by a later task — this is the last task in the plan.

- [ ] **Step 1: Fix the Profile page's details grid — write the test first**

In `app/(authenticated)/profile/ProfileView.test.tsx`, the file already defines a `sampleProps: ProfileViewProps` constant used by all three existing tests — reuse it. Add this test inside the existing `describe("ProfileView", ...)` block:

```tsx
  it("collapses the details grid to one column below sm, two columns at sm and up", () => {
    const { container } = render(<ProfileView {...sampleProps} />);
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/(authenticated)/profile/ProfileView.test.tsx`
Expected: FAIL — the current grid is `grid-cols-2` with no `grid-cols-1`/`sm:grid-cols-2`.

- [ ] **Step 3: Fix the grid**

In `app/(authenticated)/profile/ProfileView.tsx`, change (around line 80):

```tsx
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-b-xl bg-white px-8 py-7">
```

to:

```tsx
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-xl bg-white px-8 py-7 sm:grid-cols-2">
```

(No other line in this file changes — the `col-span-2` on the "Member Since" field stays correct at both breakpoints since it spans whatever the grid's column count is.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/(authenticated)/profile/ProfileView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Live-verify the remaining pages at phone and tablet widths**

With the dev server running (start fresh if needed — see this branch's handoff doc for the known `.next`/Turbopack gotcha if a build ran recently), use the browser tool to check each of these pages at two viewport sizes, **375×812 (phone)** and **768×1024 (tablet)**:

- `/dashboard` — confirm `ModuleGrid` tiles reflow without overlap or clipped text at both widths.
- `/profile` — confirm the banner (avatar, name, role pill, "Change Password" link) and the now-responsive details grid don't clip or overlap at 375px.
- `/settings` — confirm the 4-tile launcher and, after clicking into a Matrix Type row, the `MatrixTypeApproverDetail` view (filter pills, table, Add Approver modal) hold up at both widths.
- `/login` and `/change-password` — confirm the centered card, any visible toast, and (on change-password) the password-visibility-toggle fields don't clip at 375px.

For each page: if you find a concrete overflow/clipping/overlap problem, fix it with the minimal responsive class change (following the same `grid-cols-1 sm:grid-cols-2`-style pattern as Step 3) and add one regression assertion for that fix, following the same test-first pattern as Steps 1-4. If a page already holds up at both widths, no code change is needed for it — do not make speculative changes.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS on every file except the known `prisma/seed.test.ts` baseline failure(s) (seed-admin password / live-DB reference-data drift, pre-existing and unrelated to this plan). No other file should fail or change count from the pre-task baseline.

- [ ] **Step 7: Run the build**

Run: `npm run build`
Expected: clean build, no type errors.

- [ ] **Step 8: Clear `.next` before any further dev-server verification**

Since Step 7 just ran `npm run build`, its production artifacts in `.next/` will collide with a subsequently started `next dev` (known gotcha on this branch). If verifying further afterward, stop any running dev server, delete `.next`, then start `npm run dev` fresh.

- [ ] **Step 9: Commit**

```bash
git add "app/(authenticated)/profile/ProfileView.tsx" "app/(authenticated)/profile/ProfileView.test.tsx"
git commit -m "Fix Profile details grid to collapse on narrow screens; verify responsive behavior app-wide"
```

If Step 5 produced additional fixes beyond the Profile grid, stage and include those specific files in this same commit (or a follow-up commit per file, implementer's call) with a commit message describing what was fixed.
