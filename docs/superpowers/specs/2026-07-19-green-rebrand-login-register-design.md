# Outslip VMS — Green Rebrand & Login/Registration Redesign

## Status

Covers a visual redesign of the login and registration pages, a site-wide
rebrand from navy to green, and the removal of the dark/light theme system.
No behavioral changes to auth, sessions, permissions, validation, or the
wizard's steps and fields. Builds on the merged registration-login and
authenticated-dashboard work (`main` @ `9746d21`).

## Context

The app serves Mega Fishing Corporation: outslip passes for employees and
visitor passes for visitors. The previous navy "Corporate Security" style
(#0b2545, split-screen layouts) is replaced with the company's green and a
simpler centered-card language, based on a reference screenshot supplied by
the user and mockups approved interactively.

## Color System

| Token | Value | Used for |
|---|---|---|
| Primary green | `#2C7001` | Navbar, banner gradients, buttons, links, accents |
| Sidebar green | `#245c01` | Sidebar background (one step darker than navbar so the panels read as distinct) |
| Banner gradient | `#2C7001 → #1d4d00` (135deg) | Card header banners |
| Page background | `#eef1ee` | Backdrop behind centered cards |
| Card surface | white, ~10px radius, soft shadow | Login/register/change-password cards |

Navy `#0b2545` and its companion tints (`#e8eef7`, `#9fb0c9`, `#8593a8`,
etc.) disappear entirely. Secondary text uses neutral grays.

## Login Page (`/login`)

Centered card on the `#eef1ee` backdrop (no more split-screen brand panel):

- **Banner:** green gradient, subtle translucent circles, bold white
  uppercase "SIGN IN". No company or app name on the card (per user
  choice); the app name remains in page metadata and the in-app navbar.
- **Subtitle (kept verbatim):** "Sign in with your company or personal email"
- **Fields:** Email and Password as label-left + underlined-input rows.
  Password keeps the existing show/hide control.
- **"Forgot Password?"** link right-aligned below the fields — still a dead
  link (self-service reset remains deferred, unchanged from the prior spec).
- **Button:** centered green pill "Login".
- **No "Remember me"** checkbox: the reference image had one, but the app
  has no variable session length; deliberately omitted rather than shipped
  as a non-functional control.

All existing login behavior (validation, error display, `mustChangePassword`
redirect) is unchanged.

## Registration Page (`/register`)

Same card language, rendered inside the authenticated shell (navbar +
sidebar) as it is today:

- Centered card with a slimmer green banner: "REGISTER USER".
- 3-step indicator recolored green (active/completed = `#2C7001`,
  upcoming = neutral).
- All three steps, every field, all validation, and the submit flow are
  unchanged — this is purely a reskin. The card replaces the current
  split brand-panel + form layout.
- Next / Submit as green pills; Back as a quiet text button.

## Change-Password Page (`/change-password`)

Part of the same entry experience (forced first-login flow), so it gets the
same treatment: centered card, green banner, underlined inputs, green pill
button. Copy and behavior unchanged.

## App Shell & Dashboard

Layout untouched; colors swapped:

- Navbar: `#2C7001` (was navy). Brand mark and title unchanged.
- Sidebar: `#245c01`. Links and permission gating unchanged.
- Dashboard module tiles: green left-border accent and green title text.
- Main content area: white.

## Theme System Removal

Dark mode is removed entirely (user decision — nothing half-alive):

- Delete `components/dashboard/ThemeToggle.tsx`, `ThemeShell.tsx`, and
  their tests; the navbar no longer renders a toggle.
- Delete `app/api/user/theme/` (route + tests) and `lib/validation/theme.ts`.
- `app/(authenticated)/layout.tsx` stops querying `themePreference` and no
  longer wraps content in a theme provider; its test drops the
  theme-lookup assertion.
- Remove all `dark:` Tailwind variants and the `@custom-variant dark`
  declaration in `app/globals.css`; drop the OS `prefers-color-scheme`
  variable switching there too, so the app is light-only regardless of OS
  setting (this also retires the known latent conflict between OS-level and
  account-level theming flagged in the final dashboard review).
- Prisma migration drops the `themePreference` column and the `Theme` enum.
- The feature remains recoverable from git history if ever wanted again.

## Testing

- Existing behavior tests stay and must remain green (login form, wizard,
  auth routes, permissions, middleware).
- Theme-related tests are deleted with the feature; the layout test is
  updated rather than deleted.
- Styling-only changes need no new tests; any test asserting on removed
  markup (e.g. the toggle button) is updated alongside.

## Out of Scope

- Forgot-password flow (still a dead link, as before)
- "Remember me" / session-length options
- Any new pages, fields, or behavior changes
- Deployment/hosting (still undecided)

## Visual Design Reference

Approved mockups from the brainstorm session:
`.superpowers/brainstorm/1947-1784385626/content/login-final-v2.html`
(login card) and `.../registration-redesign.html` (register card inside the
green shell + recolored dashboard preview).

## Process

Implemented as a fresh branch off `main` (which now contains the merged
registration-login + authenticated-dashboard work), via
subagent-driven-development with the user's standing per-task check-in
convention.
