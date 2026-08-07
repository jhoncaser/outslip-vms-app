# Deep Forest Dark Redesign — Design

## Background

User referenced [skynexalabs.xyz](https://www.skynexalabs.xyz/) (a dark-themed digital-agency marketing site: black background, bold "Outfit" display type, neon-lime accent, pill buttons, heavy motion including a cursor-trail effect) and asked to redesign/replace the app's current look to match that energy. The app today is deliberately light-only — the theme-toggle system was fully removed early in the `green-rebrand` branch (see `2026-07-19-green-rebrand-login-register-design.md`) in favor of a single light green (`#2C7001`) look.

This spec replaces that light-only look with a dark theme, keeping the app's own brand green as the accent instead of adopting SkyNexa's lime. **This is not an optional dark-mode toggle** — it fully replaces the current light theme as the app's only look, the same way the original rebrand replaced a light/dark toggle with light-only.

Brainstormed via `superpowers:brainstorming` with the visual companion (session `1719-1786063340`, port 52903): style-direction mockup (3 options — Deep Forest / Matrix Slate / Neon Forest, user picked Deep Forest), typography specimen (4 fonts, user picked Outfit), a live hoverable motion-intensity demo (3 levels, user picked Maximal), a live scrollable table demo isolating the "re-reveal every scroll pass" question (user picked "reveal once, then stay" for table rows specifically), a live cursor-trail demo (user picked "everywhere," full SkyNexa parity), and a details screen covering status/role pills, QR codes, and the MFC watermark.

## Visual language — "Deep Forest"

- **Page/card background:** `radial-gradient(120% 100% at 20% 0%, #0f1f0a 0%, #060a06 55%, #050505 100%)` — dark green-black radial gradient, used as the base background everywhere (replaces today's `bg-[#eef1ee]` layout background and the MFC watermark).
- **Card/surface treatment:** glassy panels — `background: rgba(20,30,18,0.55)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(76,167,26,0.35)`, `border-radius: 16px`, `box-shadow: 0 0 40px rgba(44,112,1,0.25)`. Nested surfaces (tiles inside a card, e.g. dashboard module tiles) use a slightly less prominent variant: `rgba(20,30,18,0.6)` background, `1px solid rgba(76,167,26,0.3)` border, `12px` radius.
- **Accent green scale:** brand base `#2C7001` stays the identity color; brighter greens (`#3a9d0a` mid, `#57e34c` bright) are used for gradients, glow shadows, and hover states, since the flat brand green reads too dark against a near-black background to use alone for interactive elements.
- **Buttons:** pill-shaped (`border-radius: 999px`), `linear-gradient(135deg, #3a9d0a, #245c01)` fill, white bold Outfit label, glow shadow (`0 6px 20px rgba(58,157,10,0.35)`, intensifying on hover/press).
- **Typography:** [Outfit](https://fonts.google.com/specimen/Outfit) (weights 700/800) for headings, nav brand, and tile/section labels, loaded via `next/font/google` (self-hosted at build time — same technique the app already uses for its current font, no runtime request to Google). Body copy, inputs, and dense table cells stay on the existing system font stack for legibility at small sizes — Outfit is a display face for headings, not paragraph text.

## Motion — "Maximal"

- **Entrance:** cards/tiles/sections fade up (`opacity 0→1`, `translateY(14px→0)`, ~400–450ms, `cubic-bezier(0.16, 1, 0.3, 1)`) on first appearance — this is the same curve/pattern the app already uses for `login-card-in`/`toast-fade-in`/`drawer-slide-in`, extended to every card-level element app-wide. Above-the-fold content animates on page load; below-the-fold content animates on scroll-into-view (scroll-reveal).
- **Table/list rows — exception:** rows use a "reveal once, then stay" variant instead of literal scroll-reveal: each row fades in the first time it enters the viewport, then stays visible on every subsequent scroll (never re-hides/re-fades). Confirmed live via a scrollable-table demo — literal re-reveal-on-every-pass felt like the table was "reloading" itself while scrolling; reveal-once keeps the same bold entrance without that cost on tables people scroll through repeatedly all day (Register Users, Open Transactions).
- **Hover/press (buttons, cards, tiles):** lift (`translateY(-2px to -3px)`), glow shadow intensifies, some elements also scale slightly (1.02–1.04); ~250–300ms `cubic-bezier(0.16, 1, 0.3, 1)`. Buttons additionally get a diagonal shimmer sweep across the fill on hover.
- **Cursor trail:** small glowing green dots (7–19px, randomized) spawn on `mousemove`, throttled to ~35ms between spawns, fade + shrink to 30% scale over ~550–600ms, then remove themselves from the DOM. `pointer-events: none` on every dot so it never intercepts clicks or interferes with text selection/table interaction. Applies **everywhere** — every page, including dense tables and forms — per explicit user confirmation after being shown the trade-off (a trail that fires during heads-down data entry work) and choosing full parity with the reference site anyway.
- **Reduced motion:** every animation above (entrance/scroll-reveal, hover lift/glow/shimmer, cursor trail) is disabled under `prefers-reduced-motion: reduce`, extending the app's existing `globals.css` convention (already applied to `login-card-in`, `toast-fade-in`, `drawer-slide-in`) to the new effects.

## Status, role, and semantic pills

Existing solid-pastel pills (Open/Approved/Canceled statuses, First/Second/Third-level-turned-single Approver/Creator/Guard Personnel roles, dashboard tile icon badges) become tinted-glass on dark: `background: rgba(<hue>, 0.18)`, text a bright tint of the same hue, `1px solid rgba(<hue>, 0.35)` border, pill shape. Same hue mapping as today (blue=Open, green=Approved, red=Canceled, amber=Approver, slate=Creator/Guard) — only the treatment changes, not the color-coding itself, so the semantics stay recognizable.

## Special cases

- **QR codes:** generation and rendering stay completely unchanged — still real black-on-white (`QRCode.toDataURL`), still scannable, per explicit user request since these are meant to support a future scan-to-lookup feature (deferred, see handoff §3w/3x). Displayed inside a light chip (`background: #f4f8f1`, padded, rounded, subtle green glow shadow) so the QR itself never gets inverted or altered — the one deliberate exception to the dark theme.
- **MFC watermark:** removed entirely, no replacement. The Deep Forest gradient background stands on its own on every page that currently shows the watermark (Login, Change Password, Dashboard, Profile, Settings, Register Users).

## Scope

**Entire app**, replacing the current light theme everywhere — not a partial rollout. Implemented as a design-system foundation (color tokens, Outfit font wiring, base button/card/pill/table motion patterns, the cursor-trail component, and the reveal-once table utility) applied afterward page-by-page:

1. Auth — Login, Change Password
2. App shell — Navbar, Sidebar, MobileDrawer, `(authenticated)/layout.tsx`
3. Dashboard — ModuleGrid, PagePlaceholder (used by the 3 still-unbuilt transaction placeholder pages too)
4. Register Users — table + 3-step wizard
5. Settings — all 4 setup tabs (Matrix Type, Department, Business Unit, Location) + Matrix Type Approver detail view
6. Open Transactions — list, detail page, line-item modals
7. Profile

The exact task breakdown and ordering within that list is left to the implementation plan (`superpowers:writing-plans`), not fixed here — matches how the original green rebrand and the later responsive redesign were each decomposed into their own multi-task plans off a single design doc.

## Functionality guarantee

Styling/className-level changes only — no auth, session, validation, routing, or business logic touched. Existing accessible names and test selectors (`getByRole`, `getByLabelText`, `getByText`, etc.) are preserved so the current automated test suite stays green throughout (baseline: 331/333, the 2 known failures are pre-existing environmental drift unrelated to styling — see handoff §5). Each page/component is verified against both its test file and the live dev server before moving to the next, matching this branch's established convention.

## Out of scope / not decided here

- Any new feature work (approval workflow, QR scan-to-lookup, Forgot Password, etc.) — unaffected by this redesign, unchanged from their currently deferred status.
- Exact pixel-level type scale mapping (how Outfit's sizes map onto the app's existing Tailwind heading hierarchy) — resolved during implementation, not a design-level decision.
- Whether to keep the Deep Forest look long-term vs. revisit later — out of scope for this spec.
