# Deep Forest Dark Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's current light green theme with the "Deep Forest" dark theme (dark radial-gradient backgrounds, glassy glowing cards, Outfit display typography, lift/glow/shimmer motion, a global cursor-trail effect, and reveal-once scroll animation) across every page, with zero functional/behavioral change.

**Architecture:** A shared design-token module (`lib/deepForest.ts`) and two new small pieces of client-side motion infrastructure (`lib/useRevealOnce.ts`, `components/CursorTrail.tsx`) are built first (Task 1). Every subsequent task re-skins one page/component group by swapping literal Tailwind className strings for the shared tokens and removing the MFC watermark — pure presentational changes, no logic touched. A final task verifies the whole app.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS v4 (`@theme inline` CSS-first config), `next/font/google`, Vitest + Testing Library, Prisma/PostgreSQL (untouched by this plan).

## Global Constraints

- Styling/className-level changes only. No auth, session, validation, routing, Prisma query, or business logic may change in any task.
- Every existing accessible name, `role`, `aria-*` attribute, and test selector (`getByRole`, `getByLabelText`, `getByText`, etc.) must stay byte-identical — the existing test files for every touched component must pass unmodified.
- All new colors/surfaces must come from `lib/deepForest.ts` (Task 1's output) — no ad-hoc new hex values introduced in later tasks.
- Every new animation (reveal-once, button shimmer, cursor trail) must be inert under `prefers-reduced-motion: reduce`.
- QR code generation and rendering (`QRCode.toDataURL` in `app/(authenticated)/transactions/open/page.tsx`) must not change — only the `<img>` wrapper's surrounding chip styling changes.
- The MFC watermark overlay div (`bg-[url('/mfc-logo.png')] ... opacity-[0.18]`) is removed outright from every page that has it, with no replacement.
- The existing responsive breakpoints (mobile drawer/hamburger below `md` (768px) in `AppShell`/`Navbar`/`MobileDrawer`, collapsed/expandable table columns in `UsersView`/`TransactionsView`) must keep working exactly as before — only their colors/surfaces change.
- Run `npx vitest run` after every task and confirm the pass count matches the pre-task baseline (only the 2 pre-existing, unrelated `prisma/seed.test.ts` failures — seed-admin drift and reference-data drift — are expected; see `docs/superpowers/2026-07-19-green-rebrand-handoff.md` §5). If the count differs, investigate before moving on — do not assume it's fine.
- Commit after each task with a descriptive message; do not bundle multiple tasks into one commit.

---

## Task 1: Design-system foundation — tokens, Outfit font, reveal-once hook, cursor trail

**Files:**
- Create: `lib/deepForest.ts`
- Create: `lib/useRevealOnce.ts`
- Create: `lib/useRevealOnce.test.tsx`
- Create: `components/CursorTrail.tsx`
- Create: `components/CursorTrail.test.tsx`
- Create: `components/RevealRow.tsx`
- Modify: `app/layout.tsx` (entire file — add Outfit font, mount `CursorTrail`)
- Modify: `app/globals.css:1-19` (root tokens, `@theme inline` block, body rule)

**Interfaces:**
- Consumes: nothing (first task).
- Produces (used by every later task):
  - `lib/deepForest.ts` exports: `pageBackground: string`, `cardSurface: string`, `tileSurface: string`, `headingText: string`, `mutedText: string`, `buttonPrimary: string`, `buttonSecondary: string`, `fieldLabel: string`, `fieldUnderline: string`, `fieldBox: string`, `tableWrap: string`, `tableHeaderRow: string`, `tableRow(index: number): string`, `modalHeader: string`, `modalCard: string`, `pillClass(hue: "blue" | "green" | "red" | "amber" | "slate"): string`.
  - `lib/useRevealOnce.ts` exports: `useRevealOnce<T extends HTMLElement>(): { ref: React.RefObject<T | null>; revealed: boolean }`.
  - `components/CursorTrail.tsx` exports: `CursorTrail(): null` (side-effect-only component, mounted once).
  - `components/RevealRow.tsx` exports: `RevealRow(props: { index: number; className?: string; children: React.ReactNode } & Omit<React.ComponentPropsWithoutRef<"tr">, "className" | "children">): JSX.Element` — a `<tr>` that wires up `useRevealOnce` and `tableRow(index)` internally. Every task that reskins a table (Tasks 5, 6, 7) imports this directly instead of re-deriving the reveal-once wiring.
  - Global CSS classes available everywhere: `.reveal-once`, `.is-revealed`, `.btn-shimmer`, `.cursor-trail-dot`, `.cursor-trail-dot-fade`.
  - Tailwind utility `font-outfit` (via the new `--font-outfit` theme token).

- [ ] **Step 1: Create the design-token module**

Create `lib/deepForest.ts`:

```ts
// Deep Forest design tokens — the single source of truth for the dark
// redesign's colors/surfaces. Every page/component task imports from here
// instead of hardcoding new hex values.

export const pageBackground =
  "bg-[#050505] bg-[radial-gradient(120%_100%_at_20%_0%,#0f1f0a_0%,#060a06_55%,#050505_100%)] bg-no-repeat";

export const cardSurface =
  "rounded-xl border border-[#4ca71a]/35 bg-[#141e12]/70 backdrop-blur-md shadow-[0_0_40px_rgba(44,112,1,0.25)]";

export const tileSurface =
  "rounded-xl border border-[#4ca71a]/30 bg-[#141e12]/70";

export const headingText = "font-outfit font-extrabold text-white";

export const mutedText = "text-[#9db894]";

export const buttonPrimary =
  "btn-shimmer rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] px-6 py-2.5 font-outfit text-sm font-bold text-white shadow-[0_6px_20px_rgba(58,157,10,0.35)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(58,157,10,0.6)] active:translate-y-0 active:shadow-[0_4px_16px_rgba(58,157,10,0.45)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60";

export const buttonSecondary =
  "rounded-full border border-[#4ca71a]/40 bg-transparent px-5 py-2.5 text-sm font-semibold text-[#cfe9c7] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none";

export const fieldLabel = "text-[13px] text-[#9db894]";

export const fieldUnderline =
  "w-full border-b border-[#4ca71a]/40 bg-transparent pb-1.5 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#57e34c] focus:outline-none";

export const fieldBox =
  "w-full rounded border border-[#4ca71a]/40 bg-[#0f1611] px-3 py-2 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#57e34c] focus:outline-none focus:ring-1 focus:ring-[#57e34c]";

export const tableWrap =
  "overflow-x-auto rounded-xl border border-[#4ca71a]/30 bg-[#141e12]/70 backdrop-blur-md shadow-[0_0_40px_rgba(44,112,1,0.15)]";

export const tableHeaderRow = "bg-gradient-to-r from-[#245c01] to-[#3a9d0a]";

export function tableRow(index: number): string {
  return `border-b border-[#4ca71a]/15 transition-colors ${
    index % 2 === 1 ? "bg-[#0f1611]/50" : "bg-transparent"
  }`;
}

export const modalHeader =
  "relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-5 text-center";

export const modalCard =
  "w-full overflow-hidden rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] shadow-[0_0_60px_rgba(44,112,1,0.35)]";

type PillHue = "blue" | "green" | "red" | "amber" | "slate";

const PILL_HUES: Record<PillHue, string> = {
  blue: "border-[#60a5fa]/35 bg-[#60a5fa]/18 text-[#93c5fd]",
  green: "border-[#57e34c]/35 bg-[#57e34c]/18 text-[#86efac]",
  red: "border-[#f87171]/35 bg-[#f87171]/18 text-[#fca5a5]",
  amber: "border-[#fbbf24]/35 bg-[#fbbf24]/18 text-[#fcd34d]",
  slate: "border-[#94a3b8]/35 bg-[#94a3b8]/18 text-[#cbd5e1]",
};

export function pillClass(hue: PillHue): string {
  return `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PILL_HUES[hue]}`;
}
```

- [ ] **Step 2: Write the failing test for `useRevealOnce`**

Create `lib/useRevealOnce.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useRevealOnce } from "./useRevealOnce";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: ObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRevealOnce", () => {
  it("starts unrevealed, then reveals once the element intersects, then disconnects", () => {
    const { result } = renderHook(() => useRevealOnce<HTMLDivElement>());

    const node = document.createElement("div");
    act(() => {
      // @ts-expect-error - assigning a ref.current directly for the test
      result.current.ref.current = node;
    });

    expect(result.current.revealed).toBe(false);

    const observer = FakeIntersectionObserver.instances[0];
    act(() => {
      observer.callback([{ isIntersecting: false }]);
    });
    expect(result.current.revealed).toBe(false);

    act(() => {
      observer.callback([{ isIntersecting: true }]);
    });
    expect(result.current.revealed).toBe(true);
    expect(observer.disconnected).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/useRevealOnce.test.ts`
Expected: FAIL — `Cannot find module './useRevealOnce'` (file doesn't exist yet).

- [ ] **Step 4: Implement `useRevealOnce`**

Create `lib/useRevealOnce.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals an element once it first scrolls into view, then stays revealed
 * forever (never re-hides on subsequent scrolls) — used for the Deep Forest
 * redesign's entrance animation on cards/tiles/table rows.
 */
export function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}
```

Note: the test assigns `result.current.ref.current` directly, but the hook's `useEffect` already ran (with `ref.current` still `null`) before that assignment happens in `renderHook`. Real usage attaches `ref={ref}` in JSX so React sets `ref.current` *before* the effect runs. Fix the test setup instead of the hook — see Step 4b.

- [ ] **Step 4b: Fix the test to attach the ref via a real render, not a manual assignment**

Replace the test body in `lib/useRevealOnce.test.ts` with a small harness component so the ref is attached the same way real consumers attach it:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRevealOnce } from "./useRevealOnce";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: ObserverCallback;
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({ onRevealed }: { onRevealed: (r: boolean) => void }) {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>();
  onRevealed(revealed);
  return <div ref={ref} data-testid="target" />;
}

describe("useRevealOnce", () => {
  it("starts unrevealed, then reveals once the element intersects, then disconnects", () => {
    let latestRevealed = false;
    render(<Harness onRevealed={(r) => (latestRevealed = r)} />);

    expect(latestRevealed).toBe(false);

    const observer = FakeIntersectionObserver.instances[0];
    act(() => {
      observer.callback([{ isIntersecting: false }]);
    });
    expect(latestRevealed).toBe(false);

    act(() => {
      observer.callback([{ isIntersecting: true }]);
    });
    expect(latestRevealed).toBe(true);
    expect(observer.disconnected).toBe(true);
  });
});
```

Rename the file's extension to match JSX usage: this file must be `lib/useRevealOnce.test.tsx` (not `.test.ts`), since it now renders JSX. Delete the `.test.ts` version if it was created in Step 2.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/useRevealOnce.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Write the failing test for `CursorTrail`**

Create `components/CursorTrail.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CursorTrail } from "./CursorTrail";

function mockMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduceMotion && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

afterEach(() => {
  cleanup();
  document.querySelectorAll(".cursor-trail-dot").forEach((el) => el.remove());
  vi.unstubAllGlobals();
});

describe("CursorTrail", () => {
  it("spawns a trail dot on mousemove when motion is not reduced", () => {
    mockMatchMedia(false);
    render(<CursorTrail />);

    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
    );

    const dots = document.querySelectorAll(".cursor-trail-dot");
    expect(dots.length).toBe(1);
  });

  it("does nothing under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    render(<CursorTrail />);

    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
    );

    const dots = document.querySelectorAll(".cursor-trail-dot");
    expect(dots.length).toBe(0);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run components/CursorTrail.test.tsx`
Expected: FAIL — `Cannot find module './CursorTrail'`.

- [ ] **Step 8: Implement `CursorTrail`**

Create `components/CursorTrail.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

const DOT_SIZES = [7, 9, 12, 15, 19];
const SPAWN_THROTTLE_MS = 35;
const DOT_LIFETIME_MS = 600;

/**
 * Global mouse-trail effect for the Deep Forest redesign — mounted once in
 * the root layout. Renders nothing itself; spawns short-lived glowing dots
 * directly on document.body as the mouse moves.
 */
export function CursorTrail() {
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    function handleMouseMove(event: MouseEvent) {
      const now = performance.now();
      if (now - lastSpawnRef.current < SPAWN_THROTTLE_MS) return;
      lastSpawnRef.current = now;

      const size = DOT_SIZES[Math.floor(Math.random() * DOT_SIZES.length)];
      const dot = document.createElement("div");
      dot.className = "cursor-trail-dot";
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      document.body.appendChild(dot);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dot.classList.add("cursor-trail-dot-fade");
        });
      });

      setTimeout(() => dot.remove(), DOT_LIFETIME_MS);
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return null;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run components/CursorTrail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 10: Create the shared `RevealRow` table-row wrapper**

Tasks 5, 6, and 7 each reskin at least one `<table>` whose rows need the reveal-once animation. Rather than have each of those tasks re-derive the `useRevealOnce` wiring inline, create one reusable wrapper now so later tasks just import it.

Create `components/RevealRow.tsx`:

```tsx
"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";
import { tableRow } from "@/lib/deepForest";

type RevealRowProps = {
  index: number;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"tr">, "className" | "children">;

/**
 * A <tr> that fades/slides in the first time it scrolls into view, then
 * stays visible on every later scroll (Deep Forest's "reveal once" table
 * animation). Also applies the shared zebra-striping from tableRow(index).
 */
export function RevealRow({ index, className, children, ...rest }: RevealRowProps) {
  const { ref, revealed } = useRevealOnce<HTMLTableRowElement>();

  return (
    <tr
      ref={ref}
      className={`reveal-once ${revealed ? "is-revealed" : ""} ${tableRow(index)} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </tr>
  );
}
```

No dedicated test file for this component — it's a thin composition of `useRevealOnce` (already tested in Steps 2-5 above) and `tableRow` (a pure string function), with no branching logic of its own to verify beyond what those two already cover. It gets exercised indirectly by every test file for the tables that use it in Tasks 5-7.

- [ ] **Step 11: Add the Deep Forest CSS — root tokens, body, reveal-once, shimmer, cursor-trail dot**

In `app/globals.css`, replace lines 1-19 (the `@import` through the `body` rule) with:

```css
@import "tailwindcss";

:root {
  --background: #050505;
  --foreground: #eafbe4;
  --app-bg-gradient: radial-gradient(
    120% 100% at 20% 0%,
    #0f1f0a 0%,
    #060a06 55%,
    #050505 100%
  );
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-outfit: var(--font-outfit);
}

body {
  background: var(--app-bg-gradient);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

.reveal-once {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 450ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 450ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal-once.is-revealed {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-once {
    transition: none;
    opacity: 1;
    transform: none;
  }
}

.btn-shimmer {
  position: relative;
  overflow: hidden;
}

.btn-shimmer::after {
  content: "";
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent,
    rgba(255, 255, 255, 0.35),
    transparent
  );
  transform: skewX(-20deg);
  transition: left 600ms ease;
  pointer-events: none;
}

.btn-shimmer:hover::after {
  left: 130%;
}

@media (prefers-reduced-motion: reduce) {
  .btn-shimmer::after {
    transition: none;
    left: -60%;
  }
}

.cursor-trail-dot {
  position: fixed;
  z-index: 9999;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, #d4ff7a 0%, #6be34c 55%, rgba(87, 227, 76, 0) 75%);
  box-shadow: 0 0 10px 2px rgba(120, 230, 76, 0.7);
  transform: translate(-50%, -50%);
  opacity: 0.9;
  transition:
    opacity 550ms ease,
    transform 550ms ease;
}

.cursor-trail-dot-fade {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.3);
}
```

Leave the rest of the file (the `login-card-in`, `toast-fade-in`, `drawer-slide-in`, and rail-flyout rules starting at what is currently line 21) exactly as-is — those already implement "reveal once" by construction (they fire on mount, not on scroll) and don't need to change.

- [ ] **Step 12: Wire the Outfit font into the root layout and mount CursorTrail**

Replace the full contents of `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { CursorTrail } from "@/components/CursorTrail";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  weight: ["700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outslip VMS",
  description: "Outslip Visitor Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CursorTrail />
      </body>
    </html>
  );
}
```

- [ ] **Step 13: Run the full test suite**

Run: `npx vitest run`
Expected: PASS at the pre-task baseline plus 2 new tests (`useRevealOnce`, `CursorTrail` — 2 test cases), only the 2 known pre-existing `prisma/seed.test.ts` failures remaining.

- [ ] **Step 14: Run the build**

Run: `npm run build`
Expected: clean build, no type errors. Restart the dev server afterward (`Get-Process -Name node | Stop-Process -Force` then `npm run dev`) per the documented `.next` cache gotcha before any live verification.

- [ ] **Step 15: Commit**

```bash
git add lib/deepForest.ts lib/useRevealOnce.ts lib/useRevealOnce.test.tsx components/CursorTrail.tsx components/CursorTrail.test.tsx components/RevealRow.tsx app/layout.tsx app/globals.css
git commit -m "Add Deep Forest design tokens, reveal-once hook, cursor trail, and RevealRow"
```

---

## Task 2: Auth pages — Login and Change Password

**Files:**
- Modify: `app/login/page.tsx` (entire file)
- Modify: `app/login/LoginForm.tsx:44-101`
- Modify: `app/change-password/page.tsx` (entire file)
- Modify: `app/change-password/ChangePasswordForm.tsx:46-95`

**Interfaces:**
- Consumes: `pageBackground`, `cardSurface`, `modalHeader` (reused for the card's top banner), `headingText`, `mutedText`, `fieldLabel`, `fieldUnderline`, `buttonPrimary` from `lib/deepForest.ts` (Task 1).
- Produces: nothing new — leaf task.

- [ ] **Step 1: Reskin the Login page shell and remove the watermark**

Replace the full contents of `app/login/page.tsx`:

```tsx
import { LoginForm } from "./LoginForm";
import { pageBackground, cardSurface, headingText, mutedText } from "@/lib/deepForest";

export default function LoginPage() {
  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-6 ${pageBackground}`}>
      <div className={`login-card-in relative z-10 w-full max-w-[400px] overflow-hidden ${cardSurface}`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-10 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className={`text-2xl tracking-widest ${headingText}`}>
            SIGN IN
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className={`mb-6 text-center text-[13px] ${mutedText}`}>
            Sign in with your company or personal email
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
```

Note what changed vs. the original: the `bg-[#eef1ee]` wrapper and the whole `bg-[url('/mfc-logo.png')] ... opacity-[0.18]` watermark `<div>` are gone (replaced by `pageBackground` on the outer wrapper); `bg-white shadow-xl` on the card became `cardSurface`; the header gradient darkened from `#2C7001`/`#1d4d00` to `#3a9d0a`/`#1d4d00` to read against the darker card; the `SIGN IN` heading now uses `headingText` (Outfit, extrabold, white) instead of `font-extrabold text-white` directly; the subtitle now uses `mutedText` instead of `text-slate-500`.

- [ ] **Step 2: Reskin the LoginForm's error toast, labels, inputs, and button**

In `app/login/LoginForm.tsx`, add the import:

```tsx
import { fieldLabel, fieldUnderline, buttonPrimary } from "@/lib/deepForest";
```

Replace the error toast block (lines 44-53):

```tsx
        <div
          role="alert"
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-red-500 bg-[#1a0f0f] px-4 py-3 text-sm font-semibold text-red-300 shadow-[0_0_30px_rgba(248,113,113,0.25)]"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            !
          </span>
          {error}
        </div>
```

Replace all occurrences of `className="w-20 shrink-0 text-[13px] text-slate-500"` (both the email and password `<label>` elements, lines 59 and 77) with:

```tsx
          className={`w-20 shrink-0 ${fieldLabel}`}
```

Replace the email `<input>`'s className (line 70):

```tsx
            className={fieldUnderline}
```

Replace the `PasswordInput`'s `inputClassName` prop (line 87):

```tsx
            inputClassName={`${fieldUnderline} pr-9`}
```

Replace the "Forgot Password?" link's className (line 91):

```tsx
        <a href="#" className="mb-6 self-end text-xs font-semibold text-[#7be36f]">
```

Replace the submit button's className (line 98):

```tsx
          className={`mx-auto ${buttonPrimary} px-12`}
```

- [ ] **Step 3: Run the LoginForm tests**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: PASS, unchanged test count — none of the existing tests assert className strings, only roles/text/behavior.

- [ ] **Step 4: Reskin the Change Password page shell and remove the watermark**

Replace the full contents of `app/change-password/page.tsx`:

```tsx
import { ChangePasswordForm } from "./ChangePasswordForm";
import { pageBackground, cardSurface, headingText, mutedText } from "@/lib/deepForest";

export default function ChangePasswordPage() {
  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-6 ${pageBackground}`}>
      <div className={`relative z-10 w-full max-w-[400px] overflow-hidden ${cardSurface}`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-8 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className={`text-xl tracking-widest ${headingText}`}>
            SET A NEW PASSWORD
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className={`mb-6 text-center text-xs ${mutedText}`}>
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

- [ ] **Step 5: Reskin the ChangePasswordForm's success toast, labels, inputs, and button**

In `app/change-password/ChangePasswordForm.tsx`, add the import:

```tsx
import { fieldLabel, fieldUnderline, buttonPrimary } from "@/lib/deepForest";
```

Replace the success toast block (lines 46-56):

```tsx
        <div
          role="status"
          aria-live="polite"
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#57e34c] bg-[#0f1c0c] px-4 py-3 text-sm font-semibold text-[#86efac] shadow-[0_0_30px_rgba(87,227,76,0.3)]"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#3a9d0a] text-xs text-white">
            ✓
          </span>
          Password Updated!
        </div>
```

Replace both label classNames `className="text-xs text-slate-500"` (lines 59 and 71) with:

```tsx
        <label htmlFor="newPassword" className={fieldLabel}>
```
and
```tsx
        <label htmlFor="confirmPassword" className={fieldLabel}>
```

Replace both `PasswordInput`'s `inputClassName` prop (lines 68 and 80), currently `"h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"`, with:

```tsx
          inputClassName={`h-8 ${fieldUnderline} pr-9`}
```

Replace the error paragraph's className (line 84), currently `"mb-3 text-xs text-red-600"`, with:

```tsx
          className="mb-3 text-xs text-red-400"
```

Replace the submit button's className (line 92):

```tsx
          className={`mx-auto ${buttonPrimary} px-10`}
```

- [ ] **Step 6: Run the ChangePasswordForm tests**

Run: `npx vitest run app/change-password/ChangePasswordForm.test.tsx`
Expected: PASS, unchanged test count.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 1.

- [ ] **Step 8: Verify live against the dev server**

Load `/login` and `/change-password`. Confirm: dark card renders correctly, no MFC watermark, error/success toasts show in their new colors, button hover shows lift+glow+shimmer, page background matches the approved Deep Forest mockup. Check both under normal motion and with the OS "reduce motion" setting enabled (animations should stop, colors should stay).

- [ ] **Step 9: Commit**

```bash
git add app/login/page.tsx app/login/LoginForm.tsx app/change-password/page.tsx app/change-password/ChangePasswordForm.tsx
git commit -m "Reskin Login and Change Password pages for Deep Forest"
```

---

## Task 3: App shell — Navbar, Sidebar, MobileDrawer

**Files:**
- Modify: `components/dashboard/AppShell.tsx:22`
- Modify: `components/dashboard/Navbar.tsx:107-227`
- Modify: `components/dashboard/Sidebar.tsx:13-89`
- Modify: `components/dashboard/MobileDrawer.tsx:87-150`

**Interfaces:**
- Consumes: `pillClass`-style hues are not needed here; this task uses raw Deep Forest surface colors directly since the shell has no reusable token match in `lib/deepForest.ts` (it's chrome, not a card/table). No new exports needed from Task 1.
- Produces: nothing new — leaf task.

- [ ] **Step 1: Darken the AppShell's page background**

In `components/dashboard/AppShell.tsx`, replace line 22:

```tsx
    <div className="flex min-h-screen flex-col bg-[#050505]">
```

- [ ] **Step 2: Reskin the Navbar**

In `components/dashboard/Navbar.tsx`, replace the `<header>`'s className (line 107), currently `"bg-[#2C7001] px-4 py-3 text-white sm:px-6"`, with:

```tsx
    <header className="bg-gradient-to-r from-[#1d4d00] to-[#245c01] px-4 py-3 text-white shadow-[0_2px_20px_rgba(0,0,0,0.4)] sm:px-6">
```

Replace the brand text className (line 113), currently `"text-sm font-bold tracking-wide"`, with:

```tsx
          <span className="font-outfit text-sm font-bold tracking-wide">OUTSLIP VMS</span>
```

Replace both search `<input>` classNames (lines 132 and 177), currently `"w-full rounded-full border-0 bg-white py-1.5 pl-9 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"` and its `pr-3` sibling, with (desktop, `pr-11` variant):

```tsx
              className="w-full rounded-full border-0 bg-[#0c1a08] py-1.5 pl-9 pr-11 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:outline-none focus:ring-2 focus:ring-[#57e34c]/60"
```

and (mobile, `pr-3` variant):

```tsx
                className="w-full rounded-full border-0 bg-[#0c1a08] py-1.5 pl-9 pr-3 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:outline-none focus:ring-2 focus:ring-[#57e34c]/60"
```

Replace both search-icon span classNames `className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2C7001]/60"` (lines 125 and 169) with:

```tsx
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#57e34c]/70"
```

Replace the desktop QR button's className (line 138):

```tsx
              className="absolute right-1.5 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full text-[#7be36f] hover:bg-[#57e34c]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#57e34c]/50"
```

- [ ] **Step 3: Run the Navbar tests**

Run: `npx vitest run components/dashboard/Navbar.test.tsx`
Expected: PASS, unchanged test count.

- [ ] **Step 4: Reskin the Sidebar**

In `components/dashboard/Sidebar.tsx`, replace the `itemClass` constant (line 13-14):

```tsx
const itemClass =
  "group relative flex h-11 w-[46px] items-center justify-center rounded-xl text-[#7a9472] transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none";
```

Replace `greenItemClass` (line 16):

```tsx
const greenItemClass = `${itemClass} hover:bg-[#3a9d0a] hover:text-white hover:shadow-[0_0_16px_rgba(87,227,76,0.5)] focus-visible:bg-[#3a9d0a] focus-visible:text-white`;
```

Replace `greenFlyoutClass` (line 21):

```tsx
const greenFlyoutClass = `${flyoutClass} bg-gradient-to-br from-[#3a9d0a] to-[#245c01] shadow-[0_0_20px_rgba(87,227,76,0.4)]`;
```

Replace the active-link className inside `RailLink` (line 41):

```tsx
          ? `${itemClass} bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white shadow-[0_0_20px_rgba(87,227,76,0.45)]`
```

Replace the `<nav>` className (line 57):

```tsx
    <nav className="relative z-20 my-4 ml-4 hidden w-[68px] flex-shrink-0 flex-col items-center rounded-2xl border border-[#4ca71a]/30 bg-[#141e12]/80 py-3 backdrop-blur-md shadow-[0_0_30px_rgba(44,112,1,0.2)] md:flex">
```

Replace the logout `<form>`'s className (line 73), currently `"mt-auto flex w-full justify-center border-t border-[#eef1ec] pt-2.5"`, with:

```tsx
        className="mt-auto flex w-full justify-center border-t border-[#4ca71a]/25 pt-2.5"
```

- [ ] **Step 5: Run the Sidebar tests**

Run: `npx vitest run components/dashboard/Sidebar.test.tsx`
Expected: PASS, unchanged test count.

- [ ] **Step 6: Reskin the MobileDrawer**

In `components/dashboard/MobileDrawer.tsx`, replace the backdrop `<div>`'s className (line 87), currently `"fixed inset-0 z-50 bg-slate-900/35 md:hidden"`, with:

```tsx
      className="fixed inset-0 z-50 bg-black/60 md:hidden"
```

Replace the sliding panel's className (line 91), currently `"drawer-slide-in flex h-full w-[260px] flex-col bg-white shadow-xl"`, with:

```tsx
        className="drawer-slide-in flex h-full w-[260px] flex-col border-r border-[#4ca71a]/30 bg-[#0c120a] shadow-[0_0_40px_rgba(0,0,0,0.6)]"
```

Replace the header's className (line 93), currently `"flex items-center justify-between border-b border-[#eef1ec] px-4 py-3.5"`, with:

```tsx
        <div className="flex items-center justify-between border-b border-[#4ca71a]/25 px-4 py-3.5">
```

Replace the brand span's className (line 94), currently `"text-sm font-bold tracking-wide text-[#2C7001]"`, with:

```tsx
          <span className="font-outfit text-sm font-bold tracking-wide text-[#7be36f]">
```

Replace the close button's className (line 101), currently `"text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40"`, with:

```tsx
            className="text-[#9db894] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/50"
```

Replace `DrawerLink`'s className (lines 51-53):

```tsx
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white"
          : "text-[#cfe9c7] hover:bg-[#57e34c]/10"
      }`}
```

Replace the logout `<form>`'s className (line 139), currently `"border-t border-[#eef1ec] p-3"`, with:

```tsx
        <form
          action="/api/auth/logout"
          method="post"
          className="border-t border-[#4ca71a]/25 p-3"
        >
```

Replace the logout button's className (line 143), currently `"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"`, with:

```tsx
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
```

- [ ] **Step 7: Run the MobileDrawer and AppShell tests**

Run: `npx vitest run components/dashboard/MobileDrawer.test.tsx components/dashboard/AppShell.test.tsx`
Expected: PASS, unchanged test counts.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 2.

- [ ] **Step 9: Verify live against the dev server**

Load any authenticated page at desktop width — confirm the top navbar, floating icon rail, and (at phone width, via `resize_window`) the hamburger + slide-out drawer all render in Deep Forest colors, active-page highlighting still works, flyout labels still appear on hover/focus, logout still works. Confirm reduced-motion still disables the flyout/lift transitions (colors unaffected).

- [ ] **Step 10: Commit**

```bash
git add components/dashboard/AppShell.tsx components/dashboard/Navbar.tsx components/dashboard/Sidebar.tsx components/dashboard/MobileDrawer.tsx
git commit -m "Reskin app shell (Navbar/Sidebar/MobileDrawer) for Deep Forest"
```

---

## Task 4: Dashboard — ModuleGrid, PagePlaceholder, dashboard page

**Files:**
- Modify: `app/(authenticated)/dashboard/page.tsx` (entire file)
- Modify: `components/dashboard/ModuleGrid.tsx:77-144`
- Modify: `components/PagePlaceholder.tsx` (entire file)

**Interfaces:**
- Consumes: `pageBackground`, `tileSurface`, `mutedText` from `lib/deepForest.ts`; `useRevealOnce` from `lib/useRevealOnce.ts` (both Task 1).
- Produces: nothing new — leaf task.

- [ ] **Step 1: Reskin the dashboard page and remove the watermark**

Replace the full contents of `app/(authenticated)/dashboard/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { ModuleGrid } from "@/components/dashboard/ModuleGrid";
import { pageBackground } from "@/lib/deepForest";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className={`relative flex flex-1 flex-col overflow-hidden ${pageBackground}`}>
      <ModuleGrid canViewApprovals={session ? canViewApprovals(session) : false} />
    </div>
  );
}
```

- [ ] **Step 2: Reskin the module tiles and wire in reveal-once**

In `components/dashboard/ModuleGrid.tsx`, add the import:

```tsx
import { useRevealOnce } from "@/lib/useRevealOnce";
```

This file has no `"use client"` directive today — it doesn't need any state, but `useRevealOnce` is a hook, so add `"use client";` as the first line of the file.

Replace the module tile badge colors (lines 82-83, 89-90, 96-97, 105-106) — keep the same 4 hues, just brighten for dark backgrounds:

```tsx
    badgeClass:
      "bg-[#60a5fa]/20 text-[#93c5fd] group-hover:shadow-[0_0_16px_rgba(96,165,250,0.5)]",
```
(Open Transaction), then for Approved Transaction:
```tsx
    badgeClass:
      "bg-[#57e34c]/20 text-[#86efac] group-hover:shadow-[0_0_16px_rgba(87,227,76,0.5)]",
```
Canceled Transaction:
```tsx
    badgeClass:
      "bg-[#f87171]/20 text-[#fca5a5] group-hover:shadow-[0_0_16px_rgba(248,113,113,0.5)]",
```
My Approvals:
```tsx
  badgeClass:
    "bg-[#fbbf24]/20 text-[#fcd34d] group-hover:shadow-[0_0_16px_rgba(251,191,36,0.5)]",
```

Replace the `ModuleGrid` function body (lines 109-144) to wire in `useRevealOnce` per tile and restyle the tile card:

```tsx
export function ModuleGrid({
  canViewApprovals,
}: {
  canViewApprovals: boolean;
}) {
  const modules = canViewApprovals
    ? [...BASE_MODULES, APPROVALS_MODULE]
    : BASE_MODULES;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 content-start sm:grid-cols-2">
      {modules.map((module) => (
        <ModuleTile key={module.href} module={module} />
      ))}
    </div>
  );
}

function ModuleTile({
  module,
}: {
  module: (typeof BASE_MODULES)[number];
}) {
  const { ref, revealed } = useRevealOnce<HTMLAnchorElement>();

  return (
    <Link
      ref={ref}
      href={module.href}
      className={`reveal-once ${revealed ? "is-revealed" : ""} group flex items-start justify-between gap-3 border-l-4 border-l-[#3a9d0a] p-4 tile-surface transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-l-[6px] hover:shadow-[0_8px_24px_rgba(58,157,10,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[#9db894] transition-colors duration-200 group-hover:text-[#7be36f] motion-reduce:transition-none">
          {module.label}
        </div>
        <div className="mt-1 font-outfit text-2xl font-bold text-[#7be36f]">
          —
        </div>
      </div>
      <span
        aria-hidden
        className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${module.badgeClass}`}
      >
        <module.Icon />
      </span>
    </Link>
  );
}
```

Since `tile-surface` isn't a Tailwind utility, replace it with the literal `tileSurface` token instead of a bare string — fix the template literal to:

```tsx
      className={`reveal-once ${revealed ? "is-revealed" : ""} group flex items-start justify-between gap-3 border-l-4 border-l-[#3a9d0a] p-4 ${tileSurface} transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-l-[6px] hover:shadow-[0_8px_24px_rgba(58,157,10,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
```

and add `tileSurface` to the import from Step 2's top: `import { tileSurface } from "@/lib/deepForest";`.

- [ ] **Step 3: Run the ModuleGrid tests**

Run: `npx vitest run components/dashboard/ModuleGrid.test.tsx`
Expected: PASS, unchanged test count — `Link` still renders as an anchor with the same `href`/text, `ref` forwarding doesn't change the accessible tree.

- [ ] **Step 4: Reskin PagePlaceholder (still used by the 3 unbuilt transaction pages)**

Replace the full contents of `components/PagePlaceholder.tsx`:

```tsx
import { headingText, mutedText } from "@/lib/deepForest";

export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className={`text-xl ${headingText}`}>{title}</h1>
      <p className={`text-sm ${mutedText}`}>{description}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 3.

- [ ] **Step 6: Verify live against the dev server**

Load `/dashboard`. Confirm tiles fade up on load (reveal-once), hover lift/glow/shimmer works, badge colors read clearly against the dark tile background, and the 3 still-unbuilt transaction placeholder pages (`/transactions/approved`, `/transactions/canceled`, `/transactions/my-approvals`) show the dark `PagePlaceholder` correctly too.

- [ ] **Step 7: Commit**

```bash
git add "app/(authenticated)/dashboard/page.tsx" components/dashboard/ModuleGrid.tsx components/PagePlaceholder.tsx
git commit -m "Reskin Dashboard (ModuleGrid/PagePlaceholder) for Deep Forest"
```

---

## Task 5: Register Users — table, wizard, register page

**Files:**
- Modify: `app/(authenticated)/register/page.tsx` (entire file)
- Modify: `app/(authenticated)/register/UsersView.tsx:37-41, 68-261`
- Modify: `app/(authenticated)/register/RegistrationWizard.tsx:49-507`

**Interfaces:**
- Consumes: `pageBackground`, `cardSurface`, `tableWrap`, `tableHeaderRow`, `tableRow`, `modalHeader`, `modalCard`, `headingText`, `mutedText`, `fieldLabel`, `fieldUnderline`, `buttonPrimary`, `buttonSecondary`, `pillClass` from `lib/deepForest.ts`; `useRevealOnce` from `lib/useRevealOnce.ts` (both Task 1).
- Produces: nothing new — leaf task.

- [ ] **Step 1: Reskin the register page wrapper and remove the watermark**

Replace the return statement's JSX in `app/(authenticated)/register/page.tsx` (the last 11 lines) — add the import `import { pageBackground } from "@/lib/deepForest";` at the top, then replace:

```tsx
  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <UsersView users={rows} />
      </div>
    </div>
  );
```

- [ ] **Step 2: Reskin UsersView's role pills and table chrome**

In `app/(authenticated)/register/UsersView.tsx`, add the import:

```tsx
import { headingText, mutedText, tableWrap, tableHeaderRow, modalHeader, modalCard, buttonPrimary, pillClass } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";
```

Replace `ROLE_PILL_CLASSES` (lines 37-41):

```tsx
const ROLE_PILL_CLASSES: Record<RoleValue, string> = {
  CREATOR: pillClass("blue"),
  APPROVER: pillClass("amber"),
  GUARD_PERSONNEL: pillClass("slate"),
};
```

The role `<span>` (around line 151) currently does `className={\`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_PILL_CLASSES[user.role]}\`}` — since `pillClass()` already returns the full pill className including shape/padding/border, simplify that span to just:

```tsx
                        <span className={ROLE_PILL_CLASSES[user.role]}>
```

Replace the page heading block (lines 76-81):

```tsx
        <div>
          <h1 className={`text-lg ${headingText}`}>Registered Users</h1>
          <p className={`text-xs ${mutedText}`}>
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
```

Replace the "+ Register User" button's className (line 86):

```tsx
          className={buttonPrimary}
```

Replace the table wrapper's className (line 92), currently `"overflow-x-auto rounded-xl bg-white shadow"`, with:

```tsx
      <div className={tableWrap}>
```

Replace the header row's className (line 95), currently `"bg-[#2C7001]"`, with:

```tsx
            <tr className={tableHeaderRow}>
```

Replace the empty-state `<td>`'s className (line 112), currently `"px-4 py-8 text-center text-slate-500"`, with:

```tsx
                  className={`px-4 py-8 text-center ${mutedText}`}
```

- [ ] **Step 3: Wire reveal-once into each table row and restyle it**

First, rename the exported type to avoid a naming collision with the new row component added below: at the top of the file, change `export type UserRow = {...}` to `export type UserRowData = {...}`, update the `UsersView({ users }: { users: UserRowData[] })` prop type accordingly, and update `app/(authenticated)/register/page.tsx`'s import (`import { UsersView, type UserRow } from "./UsersView";` → `import { UsersView, type UserRowData } from "./UsersView";`) and its `const rows: UserRowData[] = ...` usage.

Add the import: `import { RevealRow } from "@/components/RevealRow";` (drop the now-unused `tableRow` import from `lib/deepForest` if nothing else in this file uses it directly — `RevealRow` calls it internally).

Still in `UsersView.tsx`, the row-rendering `users.map((user, index) => {...})` block (lines 118-210) currently builds each `<tr>` inline. Extract the per-row rendering into its own component so `RevealRow` is used once per row. Replace the whole `{users.map((user, index) => {...})}` block (lines 118-210) with:

```tsx
              users.map((user, index) => (
                <UserRow
                  key={user.id}
                  user={user}
                  index={index}
                  isExpanded={expandedUserId === user.id}
                  onToggle={() =>
                    setExpandedUserId(
                      expandedUserId === user.id ? null : user.id
                    )
                  }
                  onEdit={() => setModal({ mode: "edit", userId: user.id })}
                />
              ))
```

Then add a new `UserRow` component in the same file, right above `export function UsersView`:

```tsx
function UserRow({
  user,
  index,
  isExpanded,
  onToggle,
  onEdit,
}: {
  user: UserRowData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <Fragment>
      <RevealRow
        index={index}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={isExpanded}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#57e34c]/50"
      >
        <td className="px-2 py-3 text-center text-[#6f8a68]">
          <span
            aria-hidden
            className={`inline-block transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
          >
            ▸
          </span>
        </td>
        <td className="px-4 py-3 text-[#eafbe4]">{user.firstName}</td>
        <td className="px-4 py-3 text-[#eafbe4]">{user.lastName}</td>
        <td className="px-4 py-3">
          <span className={ROLE_PILL_CLASSES[user.role]}>
            {ROLE_LABELS[user.role]}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-2.5 py-1 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
          >
            <EditIcon />
            Edit
          </button>
        </td>
      </RevealRow>
      {isExpanded && (
        <tr className="bg-[#0f1611]/60">
          <td colSpan={COLUMNS.length + 1} className="px-4 py-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 pl-9 sm:grid-cols-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Job Title
                </div>
                <div className="text-sm text-[#eafbe4]">{user.jobTitle}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Department
                </div>
                <div className="text-sm text-[#eafbe4]">{user.department}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Business Unit
                </div>
                <div className="text-sm text-[#eafbe4]">{user.businessUnit}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Location
                </div>
                <div className="text-sm text-[#eafbe4]">{user.location}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Created
                </div>
                <div className="text-sm text-[#eafbe4]">{user.createdAt}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
```

- [ ] **Step 4: Reskin the modal chrome**

Still in `UsersView.tsx`, replace the modal backdrop's className (line 221), currently `"fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"`, with:

```tsx
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
```

Replace the modal card's className (line 224), currently `"w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl"`, with:

```tsx
            <div className={`max-w-[520px] ${modalCard}`}>
```

Replace the modal header's className (line 225), currently `"relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center"`, with:

```tsx
              <div className={modalHeader}>
```

Replace the modal title's className (line 234-237):

```tsx
                <h2
                  id="register-user-title"
                  className={`text-lg tracking-widest ${headingText}`}
                >
```

- [ ] **Step 5: Reskin RegistrationWizard's form fields, step indicator, and buttons**

In `app/(authenticated)/register/RegistrationWizard.tsx`, add the import:

```tsx
import { fieldLabel, fieldUnderline, buttonPrimary, buttonSecondary } from "@/lib/deepForest";
```

Replace `StepIndicator`'s active/inactive dot and bar colors (lines 55-56 and 63):

```tsx
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              n <= step
                ? "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white"
                : "bg-[#1c2519] text-[#6f8a68]"
            }`}
```
and
```tsx
              className={`h-0.5 flex-1 ${n < step ? "bg-[#3a9d0a]" : "bg-[#1c2519]"}`}
```

Replace all occurrences of `className="text-xs text-slate-500"` (the label on every field across all three steps — lines 245, 284, 294, 304, 314, 324, 342, 360, 378, 391, 402) with:

```tsx
        className={fieldLabel}
```

Replace all occurrences of the exact string `"mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"` (lines 291, 301, 311, 321, and the three `<select>`s at 332, 350, 368, and the email input at 386 — 8 occurrences total) with:

```tsx
          className={`mb-4 h-8 ${fieldUnderline}`}
```

Replace the role `<select>`'s className (line 253), currently `"mb-2 block h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"`, with:

```tsx
          className={`mb-2 block h-8 ${fieldUnderline}`}
```

Replace both `PasswordInput`'s `inputClassName` props (lines 399 and 410), currently `"h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"`, with:

```tsx
              inputClassName={`h-8 ${fieldUnderline} pr-9`}
```

Replace the role-list helper text's className (line 262), currently `"mb-4 text-[10px] leading-relaxed text-slate-400"`, with:

```tsx
        <div className="mb-4 text-[10px] leading-relaxed text-[#6f8a68]">
```

Replace all "NEXT →" / primary-action buttons' classNames — line 269 (`"ml-auto block rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"`), line 430 (same string), line 205 and 230 (`"rounded-full bg-[#2C7001] px-5 py-2.5 text-sm font-semibold text-white"`), and line 500 (`"rounded-full bg-[#2C7001] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"`) — with `${buttonPrimary}` plus whatever padding override each already had:

```tsx
          className={`ml-auto block ${buttonPrimary}`}
```
(line 269), 
```tsx
          className={`${buttonPrimary} px-5`}
```
(lines 205, 230), 
```tsx
          className={buttonPrimary}
```
(line 430), 
```tsx
          className={buttonPrimary}
```
(line 500).

Replace both "← BACK" buttons' classNames (lines 419 and 492), currently `"rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500"`, with:

```tsx
            className={buttonSecondary}
```

Replace the review-step summary box's className (line 445), currently `"mb-4 rounded border border-slate-100 bg-slate-50 p-4 text-xs leading-loose text-slate-600"`, with:

```tsx
      <div className="mb-4 rounded border border-[#4ca71a]/25 bg-[#0f1611]/60 p-4 text-xs leading-loose text-[#cfe9c7]">
```

Replace the "Select your role" / "Personal & account details" / "Review & confirm" / "Changes saved" / "Registration complete" step-title classNames (lines 194, 215, 242, 281, 442), currently `"text-sm font-bold text-[#2C7001]"` or `"mb-3(.5) text-sm font-bold text-[#2C7001]"`, with the same spacing prefix plus `text-[#7be36f]` instead of `text-[#2C7001]` (e.g. line 242's `"mb-3.5 text-sm font-bold text-[#2C7001]"` becomes `"mb-3.5 text-sm font-bold text-[#7be36f]"`).

Replace the two `role="alert"` error paragraphs' classNames (lines 176 and 483), currently `"text-sm text-red-600"` / `"mb-3 text-xs text-red-600"`, with `"text-sm text-red-400"` / `"mb-3 text-xs text-red-400"` respectively.

Replace the "Loading user…" placeholder's className (line 184), currently `"py-10 text-center text-sm text-slate-500"`, with:

```tsx
      <div className="py-10 text-center text-sm text-[#9db894]">
```

- [ ] **Step 6: Run the UsersView and RegistrationWizard tests**

Run: `npx vitest run "app/(authenticated)/register/UsersView.test.tsx" "app/(authenticated)/register/RegistrationWizard.test.tsx"`
Expected: PASS, unchanged test counts.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 4.

- [ ] **Step 8: Verify live against the dev server**

Load `/register`. Confirm the table, role pills, expandable rows (with reveal-once on scroll), Register/Edit modal, and all 3 wizard steps render correctly in Deep Forest colors with no functional change (create a test user, edit a user, confirm both flows still work end-to-end). Check mobile width still collapses the table to its core columns correctly.

- [ ] **Step 9: Commit**

```bash
git add "app/(authenticated)/register/page.tsx" "app/(authenticated)/register/UsersView.tsx" "app/(authenticated)/register/RegistrationWizard.tsx"
git commit -m "Reskin Register Users (table/wizard) for Deep Forest"
```

---

## Task 6: Settings — SettingsView, MatrixTypeApproverDetail, settings page

**Files:**
- Modify: `app/(authenticated)/settings/page.tsx` (entire file)
- Modify: `app/(authenticated)/settings/SettingsView.tsx:54-337`
- Modify: `app/(authenticated)/settings/MatrixTypeApproverDetail.tsx:54-427`

**Interfaces:**
- Consumes: `pageBackground`, `cardSurface`, `tableWrap`, `tableHeaderRow`, `modalHeader`, `modalCard`, `headingText`, `mutedText`, `fieldLabel`, `fieldBox`, `buttonPrimary`, `buttonSecondary` from `lib/deepForest.ts`; `RevealRow` from `components/RevealRow.tsx` (both Task 1).
- Produces: nothing new — leaf task.

- [ ] **Step 1: Reskin the settings page wrapper and remove the watermark**

In `app/(authenticated)/settings/page.tsx`, add the import `import { pageBackground } from "@/lib/deepForest";` at the top, then replace the return statement's outer JSX (currently lines 70-88):

```tsx
  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <SettingsView
          matrixTypes={matrixTypeRows}
          departments={departments}
          businessUnits={businessUnits}
          locations={locations}
          approverAssignments={approverAssignments}
          users={userOptions}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
```

- [ ] **Step 2: Reskin SettingsView's tables, tabs, and modal**

In `app/(authenticated)/settings/SettingsView.tsx`, add the import:

```tsx
import { tableWrap, tableHeaderRow, mutedText, headingText, fieldLabel, fieldBox, buttonPrimary, modalHeader, modalCard } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";
```

Replace `MatrixTypeTable`'s wrapper/header/empty-state (lines 55-73):

```tsx
  return (
    <div className={tableWrap}>
      <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
        <thead>
          <tr className={tableHeaderRow}>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-xs font-bold text-white">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`px-4 py-8 text-center ${mutedText}`}>
                No matrix types yet.
              </td>
            </tr>
          ) : (
```

Replace `MatrixTypeTable`'s row-map block (lines 75-93):

```tsx
            rows.map((row, index) => (
              <RevealRow
                key={row.id}
                index={index}
                onClick={() => onSelect(row)}
                className="cursor-pointer"
              >
                <td className="px-4 py-3 text-[#eafbe4]">{row.matrixCode}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="rounded font-semibold text-[#7be36f] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/40"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#eafbe4]">{row.creator}</td>
                <td className={`px-4 py-3 ${mutedText}`}>{row.createdAt}</td>
              </RevealRow>
            ))
```

Replace `SimpleTable`'s whole body (lines 103-131):

```tsx
function SimpleTable({ rows, label }: { rows: ReferenceRow[]; label: string }) {
  return (
    <div className={tableWrap}>
      <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
        <thead>
          <tr className={tableHeaderRow}>
            <th className="px-4 py-3 text-xs font-bold text-white">{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`px-4 py-8 text-center ${mutedText}`}>
                No {label.toLowerCase()} values yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <RevealRow key={row.id} index={index}>
                <td className="px-4 py-3 text-[#eafbe4]">{row.name}</td>
              </RevealRow>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

Replace the page heading block (lines 213-216):

```tsx
          <div className="mb-4">
            <h1 className={`text-lg ${headingText}`}>Settings</h1>
            <p className={`text-xs ${mutedText}`}>Manage setup values used across the app</p>
          </div>
```

Replace the tab-switcher button's className (lines 225-229):

```tsx
                className={`rounded border border-l-4 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide transition-all duration-150 ${
                  activeTab === tab.key
                    ? "border-[#57e34c] border-l-[6px] bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white shadow-[0_0_20px_rgba(87,227,76,0.35)]"
                    : "border-[#4ca71a]/25 border-l-[#3a9d0a] bg-[#141e12]/60 text-[#9db894] hover:bg-[#1a241a]"
                }`}
```

Replace the "+ Add" button's className (line 241):

```tsx
                className={`${buttonPrimary} px-5 py-2 text-xs`}
```

Replace the Add-modal's backdrop className (line 271), currently `"fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"`, with:

```tsx
              className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
```

Replace the modal card className (line 274):

```tsx
                <div className={`max-w-[420px] ${modalCard}`}>
```

Replace the modal header className (line 275):

```tsx
                  <div className={modalHeader}>
```

Replace the modal title className (lines 284-287):

```tsx
                    <h2
                      id="settings-modal-title"
                      className={`text-lg tracking-widest ${headingText}`}
                    >
```

Replace the field label className (line 303):

```tsx
                        className={`mb-1 block ${fieldLabel}`}
```

Replace the field input className (line 313):

```tsx
                        className={fieldBox}
```

Replace the modal error text className (line 317), currently `"text-xs text-red-600"`, with `"text-xs text-red-400"`.

Replace the modal submit button className (line 324):

```tsx
                      className={`w-full ${buttonPrimary}`}
```

- [ ] **Step 3: Run the SettingsView tests**

Run: `npx vitest run "app/(authenticated)/settings/SettingsView.test.tsx"`
Expected: PASS, unchanged test count.

- [ ] **Step 4: Reskin MatrixTypeApproverDetail**

In `app/(authenticated)/settings/MatrixTypeApproverDetail.tsx`, add the import:

```tsx
import { tableWrap, tableHeaderRow, mutedText, modalHeader, modalCard, headingText } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";
```

Replace the shared className constants (lines 54-61):

```tsx
const labelClassName = "mb-1 block text-xs font-semibold text-[#9db894]";
const inputClassName =
  "w-full rounded border border-[#4ca71a]/40 bg-[#0f1611] px-3 py-2 text-sm text-[#eafbe4] focus:border-[#57e34c] focus:outline-none focus:ring-1 focus:ring-[#57e34c]";
const filterButtonClassName =
  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35";
const filterButtonActiveClassName =
  "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white";
const filterButtonInactiveClassName =
  "border border-[#4ca71a]/40 bg-transparent text-[#cfe9c7] hover:border-[#57e34c] hover:bg-[#57e34c]/10";
```

Replace the toast's className (line 152), currently `"toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#2C7001] bg-white px-4 py-3 text-sm font-semibold text-[#1d4d00] shadow-lg"`, with:

```tsx
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#57e34c] bg-[#0f1c0c] px-4 py-3 text-sm font-semibold text-[#86efac] shadow-[0_0_30px_rgba(87,227,76,0.3)]"
```

Replace the "Back" button's className (line 164), currently `"mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#cfe3c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C7001] transition-colors duration-150 hover:border-[#2C7001] hover:bg-[#f2f8ee] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none"`, with:

```tsx
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
```

Replace the green banner's className (line 170):

```tsx
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-8 py-6">
```

Replace the banner title's className (line 181), currently `"text-lg font-extrabold tracking-widest text-white"`, with `` `text-lg tracking-widest ${headingText}` `` (drop the now-redundant `font-extrabold text-white` since `headingText` includes both).

Replace the "+ Add Approver" button's className (line 192), currently `"rounded-full bg-white/15 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"` — leave this one unchanged, it already reads correctly against the (still-green) banner.

Replace the table wrapper className (line 232) with `tableWrap`, and the header row className (line 235) with `tableHeaderRow`. Replace the empty-state `<td>` className (line 248) with `` `px-4 py-8 text-center ${mutedText}` ``.

Replace the row-map block (lines 253-264):

```tsx
              filtered.map((row, index) => (
                <RevealRow key={row.id} index={index}>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.approverName}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.level}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.department}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.businessUnit}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.location}</td>
                </RevealRow>
              ))
```

Replace the Add Approver modal's backdrop className (line 275), currently `"fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"`, with:

```tsx
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
```

Replace the modal card className (line 278) with `` `max-w-[420px] ${modalCard}` ``, the modal header className (line 279) with `modalHeader`, and the modal title className (lines 288-291) with the same `headingText` swap as the banner title above. Replace the modal error text className (line 409), currently `"text-xs text-red-600"`, with `"text-xs text-red-400"`. Replace the modal submit button className (line 416):

```tsx
                  className="w-full rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] disabled:pointer-events-none disabled:opacity-60"
```

- [ ] **Step 5: Run the MatrixTypeApproverDetail tests**

Run: `npx vitest run "app/(authenticated)/settings/MatrixTypeApproverDetail.test.tsx"`
Expected: PASS, unchanged test count.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 5.

- [ ] **Step 7: Verify live against the dev server**

Load `/settings` as an admin user. Confirm all 4 setup tabs, the Add modals, and drilling into a Matrix Type's approver detail view (filters, table, Add Approver modal, Back button, success toast) all render correctly in Deep Forest colors. Confirm the read-only view for a non-admin still hides every "+ Add"/"Add Approver" affordance, per the existing `canEdit` gating (unchanged logic).

- [ ] **Step 8: Commit**

```bash
git add "app/(authenticated)/settings/page.tsx" "app/(authenticated)/settings/SettingsView.tsx" "app/(authenticated)/settings/MatrixTypeApproverDetail.tsx"
git commit -m "Reskin Settings (setup tables + approver detail) for Deep Forest"
```

---

## Task 7: Open Transactions — list, detail, line items

**Files:**
- Modify: `app/(authenticated)/transactions/open/page.tsx` (entire file)
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx:56-663`
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx` (entire file)
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx:187-827`

**Interfaces:**
- Consumes: `pageBackground`, `cardSurface`, `tableWrap`, `tableHeaderRow`, `tableRow`, `modalHeader`, `modalCard`, `headingText`, `mutedText`, `fieldLabel`, `fieldBox`, `buttonPrimary`, `buttonSecondary` from `lib/deepForest.ts`; `useRevealOnce` from `lib/useRevealOnce.ts` (both Task 1).
- Produces: nothing new — leaf task.

- [ ] **Step 1: Reskin both transactions page wrappers and remove the watermark**

In `app/(authenticated)/transactions/open/page.tsx`, add the import `import { pageBackground } from "@/lib/deepForest";` at the top, then replace the return statement's outer JSX (currently lines 88-104):

```tsx
  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <TransactionsView
          transactions={transactionRows}
          matrixTypes={matrixTypes}
          currentUserBusinessUnit={currentUserBusinessUnit}
          departments={departments}
          businessUnits={businessUnits}
        />
      </div>
    </div>
  );
```

In `app/(authenticated)/transactions/open/[id]/page.tsx`, add the same import, then replace the return statement's outer JSX (currently lines 147-163):

```tsx
  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
          approvers={approvers}
        />
      </div>
    </div>
  );
```

- [ ] **Step 2: Reskin the QR chip in the transactions table**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, add the import:

```tsx
import { headingText, mutedText, tableWrap, tableHeaderRow, modalHeader, modalCard, buttonPrimary, fieldLabel, fieldBox, pillClass } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";
```

Replace the QR thumbnail button's className (line 111), currently `"h-12 w-12 overflow-hidden rounded border border-slate-200 transition-colors hover:border-[#2C7001] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"`, with a light chip so the QR code itself stays scannable — per the spec, this is the one deliberate exception to the dark theme:

```tsx
                          className="h-12 w-12 overflow-hidden rounded-lg border-2 border-[#4ca71a]/40 bg-[#f4f8f1] p-1 shadow-[0_0_12px_rgba(87,227,76,0.25)] transition-colors hover:border-[#57e34c] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/40"
```

Replace the enlarged-QR modal's backdrop className (line 143), currently `"fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"`, with:

```tsx
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
```

Replace the modal card className (line 146), currently `"w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl"`, with:

```tsx
            <div className={`max-w-[320px] ${modalCard}`}>
```

Replace the modal header className (line 147), currently `"relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center"`, with:

```tsx
              <div className={modalHeader}>
```

Replace the modal title className (lines 156-159):

```tsx
                <h2
                  id="qr-modal-title"
                  className={`text-lg tracking-widest ${headingText}`}
                >
```

Replace the image wrapper's className (line 171), currently `"flex justify-center px-8 py-7"`, with a light chip matching the table thumbnail's treatment so the enlarged QR stays scannable too:

```tsx
              <div className="flex justify-center bg-[#f4f8f1] px-8 py-7">
```

Replace the status pill's className (line 124), currently `"rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"`, with the shared token:

```tsx
                        <span className={pillClass("slate")}>
```

- [ ] **Step 3: Reskin the table wrapper, header, rows, and page heading**

Replace the table's column header className (line 74), currently `"whitespace-nowrap px-4 py-3 text-xs font-bold text-white"` — leave the text/weight/color as-is (already correct for a dark header), only the parent `<tr>` needs a token swap: replace the table wrapper's className (line 67) with `tableWrap`, and the header row's className (line 70) with `tableHeaderRow`. Replace the empty-state `<td>`'s className (line 84) with `` `px-4 py-8 text-center ${mutedText}` ``.

Replace the row-map block (lines 89-132):

```tsx
              rows.map((row, index) => (
                <RevealRow
                  key={row.id}
                  index={index}
                  onClick={() => router.push(`/transactions/open/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/transactions/open/${row.id}`);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#57e34c]/40"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEnlargedCode(row.transactionCode);
                      }}
                      className="h-12 w-12 overflow-hidden rounded-lg border-2 border-[#4ca71a]/40 bg-[#f4f8f1] p-1 shadow-[0_0_12px_rgba(87,227,76,0.25)] transition-colors hover:border-[#57e34c] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/40"
                    >
                      <img
                        src={row.qrDataUrl}
                        alt={`QR code for transaction ${row.transactionCode}`}
                        className="h-full w-full"
                      />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{row.transactionCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{row.matrixTypeName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{row.createdBy}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={pillClass("slate")}>{row.statusName}</span>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 ${mutedText}`}>{row.createdAt}</td>
                </RevealRow>
              ))
```

This replaces the `Fragment`-wrapped `<tr>` from the original (the `Fragment` import in this file becomes unused after this change and its wrapper is no longer needed here — leave the `import { Fragment, ... }` statement alone since `Fragment` may still be used elsewhere in the file; only remove it if a build/lint pass flags it as unused after all of Task 7's steps are done).

Replace the page heading block (lines 569-570):

```tsx
          <h1 className={`text-lg ${headingText}`}>Open Transaction</h1>
          <p className={`text-xs ${mutedText}`}>Filed requests awaiting further action</p>
```

Replace the "+ Add Transaction" button's className (line 575) with `` `${buttonPrimary} px-5 py-2 text-xs` ``.

- [ ] **Step 4: Reskin the Add Transaction modal chrome and every form field**

Replace the modal card's className (line 591) with `` `max-w-[420px] ${modalCard}` ``, the modal header's className (line 592) with `modalHeader`, the submit button's className (line 651) with `` `w-full ${buttonPrimary}` ``.

Replace every occurrence of the label pattern `"mb-1 block text-xs font-semibold text-slate-600"` (confirmed at lines 538, 550, 562, 574, 586, 598, 610, 635, 651, 675, 695, 703, 711, 723, 737 — 15 occurrences) with `fieldLabel` (note: `fieldLabel` doesn't include `mb-1 block`, so use `` `mb-1 block ${fieldLabel}` ``).

Replace every occurrence of the input pattern `"w-full rounded border border-slate-300 px-3 py-2 text-sm"` (lines 546, 558, 570, 582, 594, 606, 621, 643, 682, 731, 745 — 11 occurrences) with `fieldBox`.

Replace the read-only Job Position/Business Unit display boxes' classNames (lines 698 and 706), currently `"w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500"`, with:

```tsx
                          <div className="w-full rounded border border-[#4ca71a]/25 bg-[#0f1611]/60 px-3 py-2 text-sm text-[#9db894]">
```

Replace the Employee Type toggle buttons' active/inactive classNames (lines 662-663):

```tsx
                                ? "border-[#57e34c] bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white"
                                : "border-[#4ca71a]/30 text-[#9db894]"
```

Replace the checkbox input's className (line 359), currently `"h-4 w-4 rounded border-slate-300 text-[#2C7001] focus:ring-1 focus:ring-[#2C7001]"`, with:

```tsx
                    className="h-4 w-4 rounded border-[#4ca71a]/40 bg-[#0f1611] text-[#57e34c] focus:ring-1 focus:ring-[#57e34c]"
```

Replace its wrapping fieldset's className (line 349), currently `"grid grid-cols-2 gap-x-3 gap-y-2 rounded border border-slate-300 p-3"`, with:

```tsx
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded border border-[#4ca71a]/30 p-3">
```

Replace the checkbox label's className (line 353), currently `"flex items-center gap-2 text-sm text-slate-700"`, with:

```tsx
                  className="flex items-center gap-2 text-sm text-[#cfe9c7]"
```

Replace the read-only role-value pill span (line 715), currently `"inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"`, with:

```tsx
                            <span className="inline-block rounded-full bg-[#94a3b8]/18 border border-[#94a3b8]/35 px-3 py-1 text-xs text-[#cbd5e1]">
```

- [ ] **Step 5: Run the TransactionsView tests**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, unchanged test count.

- [ ] **Step 6: Reskin TransactionDetailView**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`, add the import:

```tsx
import { headingText, mutedText, tableWrap, tableHeaderRow, modalHeader, modalCard, buttonPrimary, buttonSecondary, fieldLabel, fieldBox, pillClass } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";
```

Replace the "Back to Open Transactions" link's className (line 316), currently ending in `text-[#2C7001] transition-colors duration-150 hover:border-[#2C7001] hover:bg-[#f2f8ee] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none` (a `<Link>`, not a `<button>`, since it's a real route navigation — keep the `<Link>` element itself and its `href` unchanged, only swap the className), with:

```tsx
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
```

Replace the header card's className (line 322), currently `"mb-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow sm:flex-row sm:items-start"`, with:

```tsx
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[#4ca71a]/35 bg-[#141e12]/70 backdrop-blur-md p-6 shadow-[0_0_40px_rgba(44,112,1,0.25)] sm:flex-row sm:items-start"
```

Replace the QR `<img>`'s className (line 326), currently `"h-28 w-28 shrink-0 rounded border border-slate-200"`, with the same light-chip treatment as Task 7 Step 2:

```tsx
          className="h-28 w-28 shrink-0 rounded-lg border-2 border-[#4ca71a]/40 bg-[#f4f8f1] p-1.5 shadow-[0_0_16px_rgba(87,227,76,0.25)]"
```

Replace every field-label className `"text-[10px] font-bold uppercase tracking-wide text-slate-400"` (lines 330, 334, 340, 346, 353 — 5 occurrences) with:

```tsx
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
```

Replace every field-value className `"text-sm text-slate-800"` (lines 331, 337, 343, 349, 356 — 5 occurrences) with:

```tsx
            <p className="text-sm text-[#eafbe4]">
```

Replace the "Line Items" section heading (line 363), currently `"text-sm font-bold text-slate-700"`, and its count span (line 365), currently `"font-normal text-slate-400"`, with:

```tsx
        <h2 className="font-outfit text-sm font-bold text-white">
```
and
```tsx
          <span className="font-normal text-[#6f8a68]">
```

Replace the "+ Add Line Item" button's className (line 370) with `` `${buttonPrimary} px-5 py-2 text-xs` ``.

Replace the line-items table wrapper (line 376) with `tableWrap`, header row (line 379) with `tableHeaderRow`, and empty-state `<td>` (line 393) with `` `px-4 py-8 text-center ${mutedText}` ``.

Replace the row-map block (lines 398-460):

```tsx
              lineItems.map((item, index) => (
                <RevealRow key={item.id} index={index}>
                  {isVisitorPass ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.visitorName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.jobTitle}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.company}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.contactNumber || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.transportType}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.plateNo || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.hasFile ? (
                          <a
                            href={`/api/line-items/${item.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#7be36f] hover:underline"
                          >
                            📎 {item.uploadFileName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={pillClass("slate")}>{item.employeeType}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.employeeName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.jobPosition}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.department}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.businessUnit}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#eafbe4]">{item.remarks}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openEditModal(item)}
                      className="mr-2 inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-[#7be36f] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openDeleteModal(item)}
                      className="inline-block text-[#6f8a68] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-red-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      🗑️
                    </button>
                  </td>
                </RevealRow>
              ))
```

Replace the "List Approvers" heading and count span (lines 469, 471) the same way as the Line Items heading/count above.

Replace the approvers card's className (line 474), currently `"rounded-xl bg-white p-6 shadow"`, with:

```tsx
        <div className="rounded-xl border border-[#4ca71a]/35 bg-[#141e12]/70 backdrop-blur-md p-6 shadow-[0_0_40px_rgba(44,112,1,0.25)]">
```

Replace the empty-approvers text className (line 476), currently `"text-center text-sm text-slate-500"`, with `` `text-center text-sm ${mutedText}` ``.

Replace the level-group heading (line 483), currently `"mb-2 text-xs font-bold uppercase tracking-wide text-slate-500"`, with:

```tsx
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9db894]">
```
and its count span (line 485), currently `"font-normal normal-case text-slate-400"`, with `"font-normal normal-case text-[#6f8a68]"`.

Replace the approver avatar circle's className (line 492), currently `"flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0df] text-xs font-bold text-[#2C7001]"`, with:

```tsx
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-xs font-bold text-white">
```

Replace the approver name span (line 495), currently `"text-sm text-slate-700"`, with `"text-sm text-[#cfe9c7]"`.

Replace the Add Line Item modal card (line 514) with `` `max-w-[420px] ${modalCard}` `` and its header (line 515) with `modalHeader`. Replace every one of its 15 field labels (`"mb-1 block text-xs font-semibold text-slate-600"`, lines 538, 550, 562, 574, 586, 598, 610, 635, 651, 675, 695, 703, 711, 723, 737) with `` `mb-1 block ${fieldLabel}` ``, and every one of its inputs (`"w-full rounded border border-slate-300 px-3 py-2 text-sm"`, 11 occurrences at lines 546, 558, 570, 582, 594, 606, 621, 682, 731, 745, plus the disabled-looking read-only boxes at 698/706 which get the same `bg-[#0f1611]/60`/`text-[#9db894]` treatment as Task 7 Step 4's equivalents) with `fieldBox`. Replace the plate-no input at line 643 the same way. Replace the Employee Type toggle at line 662-663 the same way as Step 4 above. Replace the role-value pill at line 715 the same way as Step 4 above. Replace the submit button (line 759) with `` `w-full ${buttonPrimary}` ``.

Replace the delete-confirmation modal card (line 776), currently `"w-full max-w-[340px] overflow-hidden rounded-xl bg-white p-6 text-center shadow-xl"`, with:

```tsx
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-red-500/30 bg-[#1a0f0f] p-6 text-center shadow-[0_0_40px_rgba(248,113,113,0.25)]">
```

Replace the delete-warning icon circle (line 777), currently `"mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl"`, with `"mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-xl"`, and the title (line 782), currently `"mb-2 text-sm font-extrabold text-slate-800"`, with `"mb-2 text-sm font-extrabold text-white"`.

- [ ] **Step 7: Run the TransactionDetailView tests**

Run: `npx vitest run "app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx"`
Expected: PASS, unchanged test count.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 6.

- [ ] **Step 9: Verify live against the dev server**

Load `/transactions/open`, file a transaction of at least two different matrix types (confirm required-field validation still works per type), click into its detail page, add/edit/delete a line item, click the QR thumbnail to confirm the enlarge modal still shows a scannable QR on its light chip. Confirm the List Approvers panel still renders (or shows its empty state) correctly in dark colors.

- [ ] **Step 10: Commit**

```bash
git add "app/(authenticated)/transactions/open/page.tsx" "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/[id]/page.tsx" "app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx"
git commit -m "Reskin Open Transactions (list/detail/line items) for Deep Forest"
```

---

## Task 8: Profile

**Files:**
- Modify: `app/(authenticated)/profile/page.tsx` (entire file)
- Modify: `app/(authenticated)/profile/ProfileView.tsx` (entire file)

**Interfaces:**
- Consumes: `pageBackground`, `cardSurface`, `headingText`, `mutedText` from `lib/deepForest.ts` (Task 1). No `useRevealOnce` here — the whole card is always above the fold, same reasoning as the auth pages.
- Produces: nothing — final leaf task.

- [ ] **Step 1: Reskin the profile page wrapper and remove the watermark**

In `app/(authenticated)/profile/page.tsx`, add the import `import { pageBackground } from "@/lib/deepForest";` at the top, then replace the return statement's outer JSX (currently lines 41-61):

```tsx
  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
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
```

- [ ] **Step 2: Reskin ProfileView**

Replace the full contents of `app/(authenticated)/profile/ProfileView.tsx`:

```tsx
import Link from "next/link";

function LockIcon() {
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
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

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

const fieldLabelClassName = "mb-1 text-xs font-semibold text-[#9db894]";
const fieldValueClassName = "text-sm text-[#eafbe4]";

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
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#4ca71a]/35 shadow-[0_0_40px_rgba(44,112,1,0.25)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-8 py-7">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
        />
        <div className="relative flex flex-col gap-4 sm:block">
          <Link
            href="/change-password"
            className="z-10 inline-flex w-fit items-center gap-1.5 self-end rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:absolute sm:right-6 sm:top-6"
          >
            <LockIcon />
            Change Password
          </Link>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
              {initials}
            </span>
            <div>
              <h1 className="font-outfit text-lg font-bold text-white">{fullName}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                <span>{jobTitle}</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-xl border-t border-[#4ca71a]/25 bg-[#141e12]/85 backdrop-blur-md px-8 py-7 sm:grid-cols-2">
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

- [ ] **Step 3: Run the ProfileView tests**

Run: `npx vitest run "app/(authenticated)/profile/ProfileView.test.tsx"`
Expected: PASS, unchanged test count.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: same baseline as after Task 7.

- [ ] **Step 5: Verify live against the dev server**

Load `/profile`. Confirm the banner, initials avatar, role pill, Change Password link (still clickable — re-check the §3z z-index fix wasn't lost), and details grid all render correctly in Deep Forest colors at desktop and phone widths.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/profile/page.tsx" "app/(authenticated)/profile/ProfileView.tsx"
git commit -m "Reskin Profile page for Deep Forest"
```

---

## Task 9: Final verification

**Files:**
- No new files. Read-only verification across the whole app.

**Interfaces:**
- Consumes: the complete Deep Forest redesign from Tasks 1-8.
- Produces: nothing — terminal task.

- [ ] **Step 1: Grep for leftover light-theme literals**

Run each of these and confirm zero matches outside of `node_modules`, `.next`, and this plan's own `docs/superpowers/` files:

```bash
grep -rn "bg-\[#eef1ee\]" app components --include="*.tsx" | grep -v ".test.tsx"
grep -rn "bg-white shadow" app components --include="*.tsx" | grep -v ".test.tsx"
grep -rn "text-slate-[4-9]00" app components --include="*.tsx" | grep -v ".test.tsx"
grep -rn "mfc-logo" app components --include="*.tsx"
```

If any match remains, fix it using the same `lib/deepForest.ts` tokens as the task that owns that file, then re-run the grep.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: full count from Task 8, only the 2 known pre-existing `prisma/seed.test.ts` failures remaining.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: clean build, no type errors, no unused-import warnings from the `lib/deepForest.ts` token swaps. Restart the dev server afterward per the `.next` cache gotcha.

- [ ] **Step 4: Live walkthrough — every page, both interaction modes**

Using the running dev server, visit every page this plan touched: `/login`, `/change-password`, `/dashboard`, `/register`, `/settings` (all 4 tabs + an approver detail drill-in), `/transactions/open` (list + detail + line items), `/profile`, plus the 3 still-unbuilt placeholder pages. For each: confirm no light-theme colors remain, no MFC watermark, the cursor trail fires on mouse movement, reveal-once animates tables/tiles on first scroll into view without re-hiding on subsequent scrolls, and every button's hover shows lift + glow + shimmer.

- [ ] **Step 5: Reduced-motion pass**

Using `resize_window` with `colorScheme`/OS emulation or the browser's dev-tools "prefers-reduced-motion: reduce" emulation, reload each page from Step 4 and confirm: no entrance/reveal animation, no button lift/shimmer, no cursor trail dots — but all colors and layout stay identical to the normal-motion pass.

- [ ] **Step 6: Responsive pass**

At phone width (375px) and tablet width (768px), re-check the mobile hamburger/drawer, the collapsed/expandable Register Users and Open Transactions tables, and the Profile details grid — confirm the breakpoint behavior from the earlier responsive-redesign plan is unchanged, just re-skinned.

- [ ] **Step 7: No-secrets check**

Run: `git diff main --stat` (or `git diff <starting-commit> --stat` for this branch) to confirm only the files this plan intended to touch were changed, and skim the diff for anything that looks like a credential, API key, or connection string accidentally introduced.

- [ ] **Step 8: Update the branch handoff doc**

Append a new dated section to `docs/superpowers/2026-07-19-green-rebrand-handoff.md` (or start a fresh handoff doc if that one has grown unwieldy) summarizing: the Deep Forest redesign is complete across all 8 page/component tasks, current test baseline, build status, and that the branch remains unmerged into `main` per the standing deferred-merge convention.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/2026-07-19-green-rebrand-handoff.md
git commit -m "Complete Deep Forest redesign: final verification pass"
```
