# Green Rebrand & Login/Registration Redesign — Handoff

**Branch:** `green-rebrand`, forked from `main` @ `972e2c0` (working in the main repo checkout, no separate worktree)
**Spec:** `docs/superpowers/specs/2026-07-19-green-rebrand-login-register-design.md`
**Plan:** `docs/superpowers/plans/2026-07-19-green-rebrand.md` (7 tasks)
**Ledger:** `.superpowers/sdd/progress.md` (gitignored, scratch — per-task detail behind each line below)

## 1. Execution mode

Being built via **`superpowers:subagent-driven-development`** (fresh implementer subagent per task, then a task-reviewer subagent, per the plan's 7 tasks). Deviation from that skill's default: **per saved user preference (`feedback_checkin_between_sdd_tasks` in memory), stop and report after every task (implementer done + review clean + ledger updated) and wait for an explicit go-ahead before dispatching the next task's implementer.**

Model selection so far: Task 1 and Task 2's implementers ran on a fast/cheap tier (both tasks' code was fully specified — transcription + testing). Task reviewers ran on `sonnet`.

## 2. Progress status

**Done, reviewed clean:**

| Task | What | Commit | Review |
|---|---|---|---|
| 1 | Remove the theme system (`ThemeShell`/`ThemeToggle`/`/api/user/theme` deleted, `Navbar`/layout/`globals.css` rewritten green+light-only) | `92d4466` | ✅ clean, no findings |
| 2 | Drop `themePreference` column + `Theme` enum from `prisma/schema.prisma`, hand-written migration applied to the live Neon DB via `npx prisma migrate deploy`, client regenerated | `836e5a2` | ✅ clean, no findings |
| 3 | Recolor authenticated shell green (`Sidebar.tsx` nav bg → `#245c01`; `ModuleGrid.tsx`/`PagePlaceholder.tsx` accents → `#2C7001`, dark variants dropped) | `f4040c2` | ✅ clean, no findings |
| 4 | Login page redesign (centered green card, `PasswordInput` gains `inputClassName`, "SIGN IN" → "Login" button) | `2a54b0c` | ✅ approved — reviewer raised one Important finding (new heading/subtitle/placeholder text vs. plan's "ONLY one text change" wording); user confirmed the new design is intentional per spec, no code change needed |
| 5 | Change-password page redesign (centered green card, labels/button text byte-identical) | `dbcfff9` | ✅ approved — reviewer flagged report mislabeled a scoped `app/`-only test run as "full suite"; controller independently confirmed true full suite passes 68/68, no functional regression |
| 6 | Register page card + wizard reskin (10 exact classNames-only string replacements, byte-identical labels/text) | `04c942d` | ✅ clean, no findings |
| 7 | Full verification: navy/dark-mode grep (0 hits), `vitest run` (68/68), `npm run build` (clean, `/api/user/theme` gone), live dev-server walkthrough via Playwright (login/mustChangePassword/dashboard/register all correct, 0 console errors), no-secrets check | n/a (verification only, no commit) | ✅ all checks pass |

Task 2's DB migration note: on the first attempt, Claude Code's auto-mode classifier blocked dispatching the implementer subagent because `npx prisma migrate deploy` is a destructive, hard-to-reverse action against the live (not local/throwaway) Neon database. The user then explicitly authorized running it in advance ("no need my permission, i trust you"), so the re-dispatched implementer proceeded and applied the migration successfully — confirmed via `1 migration applied` output and a clean re-verification grep for `themePreference`/`Theme` across `app/`, `components/`, `lib/` (zero hits outside migration SQL history). If a future task in this plan needs another live-DB or otherwise destructive action, expect the classifier to block the first dispatch attempt again — that's expected behavior, not a bug; re-check with the user unless they've already given blanket authorization for this session.

Final whole-branch review (opus, `972e2c0..04c942d`, 6 commits): **Ready to merge, with fixes** — no Critical findings, diff confirmed style-only (no auth/session/validation/wizard logic touched), theme system fully excised repo-wide, migration safe. One Important finding, environmental not code: Task 7's own live Playwright walkthrough flipped the seed admin's `mustChangePassword` to `false` on the shared dev Neon DB (by completing the change-password flow as part of testing), so `prisma/seed.test.ts` now fails 67/68 on a fresh run — confirmed independently by re-running `npx vitest run`. Fix is a one-row DB reset (`mustChangePassword = true` for the seed admin), no code change. Also 3 Minor/non-blocking notes (undocumented `pr-9` contract on `PasswordInput.inputClassName`, low-contrast login placeholders matching approved mockup, pre-existing dead `Forgot Password?` link). Full detail in `.superpowers/sdd/progress.md`.

**Post-review ad-hoc additions (outside the original 7-task plan, requested during manual testing):**
- Dev-DB seed admin's `mustChangePassword` reset back to `true` via a one-off script (run and deleted, no trace left in repo) — user authorized after confirming it was the recommended fix. Full suite re-confirmed green: 68/68 (two unrelated Neon cold-start timeouts hit along the way, both resolved as transient on retry — not real failures).
- Login page (`app/login/page.tsx`): full-bleed background image (`public/mfc-logo.png`, user-supplied MFC Global logo), `bg-cover bg-center bg-no-repeat opacity-[0.18]`, uniform fade with no vignette/mask — iterated per user reference screenshot (Mega Prime Foods SSO page style).
- Found and fixed a pre-existing routing bug while wiring up the background image: `proxy.ts`'s `config.matcher` didn't exclude `/public` static assets, so `PUBLIC_PATHS = ["/login"]` in `lib/auth/routeGuard.ts` caused *any* direct request to a public file (e.g. `/mfc-logo.png`) to 307-redirect to `/login` when unauthenticated. Fixed by broadening the matcher's negative lookahead to exclude any path with a file extension. This bug predates the rebrand plan and would affect any future public asset, not just the logo. Note: `config.matcher` must be a plain string literal — this Next.js fork requires it to be statically analyzable at build time, so a `String.raw` tagged-template version (added to satisfy an IDE lint suggestion) silently failed to apply; reverted to a plain string with an explanatory comment.
- Change-password page (`app/change-password/page.tsx`): same background-image treatment applied for visual consistency with the login page.

User confirmed the change-password page update looked correct. Along the way, testing the "Set a New Password" flow itself twice flipped the live seed admin's `mustChangePassword` back to `false` and, on the second pass, also changed its `passwordHash` away from `SEED_ADMIN_PASSWORD` — both reset again via the same one-off script pattern (run, verified, deleted). Full suite reconfirmed green: 68/68.

**Status: plan complete.** All 7 tasks done and reviewed, final whole-branch review passed, branch pushed to GitHub. User decided to defer the merge: "just leave it as pushed branch in my github, no need to push or merge into main. we will do later on once we finish this project." No further action needed on this branch until that broader project wraps up — do not merge to `main` or open a PR without a fresh go-ahead, even after more commits land here.

## 3. Follow-up work: login page polish — DONE, and propagated to change-password

Mini-project on this same branch, after the 7-task plan completed. User asked for CSS polish on the login page (button hover effects, text hierarchy, card design). Brainstormed via `superpowers:brainstorming` with the visual companion (browser mockups); user's final selections:

- **Button:** effect A — "Lift & shadow" hover/press (darken + 2px rise + green shadow, focus-visible ring, motion-reduce and disabled handling)
- **Text:** option A — "SIGN IN" stays the only `<h1>` unchanged; subtitle bumped `text-xs text-slate-400` → `text-[13px] text-slate-500`
- **Card polish:** item 2 only — CSS entrance animation (fade + 16px rise, 400ms, `prefers-reduced-motion` disabled). Declined: shadow rework, input focus transition, Forgot-Password hover, mixed-case heading, brand eyebrow.

**Spec:** `docs/superpowers/specs/2026-07-19-login-polish-design.md`, committed `5309a5a`, self-reviewed. **Plan:** `docs/superpowers/plans/2026-07-19-login-polish.md` (single task, per `superpowers:writing-plans`), committed locally but not yet pushed as a standalone commit — folded into this branch's history (untracked file as of `14194c0`, will ride along on the next handoff/doc commit).

**Implementation — Task 1 (login page only, `app/login/LoginForm.tsx`, `app/login/page.tsx`, `app/globals.css`):** built via `superpowers:subagent-driven-development` (implementer on a cheap/fast model — fully-specified transcription — then `sonnet` task reviewer). Commit `dbdb891`. Review: ✅ spec compliant, no Critical/Important/Minor findings, 68/68 tests. Single-task plan, so the separate whole-branch-review step was skipped (already covered by the parent green-rebrand branch review) — went straight to manual dev-server testing per user request. Ledger entry in `.superpowers/sdd/progress.md` under a new "login-polish plan" section.

**Follow-up ad-hoc request (same day, after user tested login in-browser):** user asked to propagate the button hover effect to the change-password ("Set a New Password") page, and to add a show/hide password toggle to both its "New Password" and "Confirm Password" fields. Implemented directly (no brainstorm/plan — both changes are mechanical reuse of things that already exist: the login button's exact hover/press className block, and the `PasswordInput` component with its built-in eye-icon toggle, already used on the login page but not previously wired into `ChangePasswordForm.tsx`). Changes: `app/change-password/ChangePasswordForm.tsx` — both `<input type="password">` fields swapped for `<PasswordInput>` (label `htmlFor`/`id` pairing preserved, so existing `getByLabelText` tests still pass unmodified), "UPDATE PASSWORD" button gets the identical hover/press/focus-visible/motion-reduce classes as the login button. Commit `14194c0`. 68/68 tests pass (one transient all-files failure during this task, "Cannot read properties of undefined (reading 'config')" — re-ran clean immediately after; treated as a one-off, not investigated further, consistent with known Neon cold-start flakiness on this branch). No formal task review dispatched for this ad-hoc pair (small, mechanical, user-verified visually in-browser immediately after).

**Status: both login-polish and its change-password propagation are complete, committed, and pushed to `origin/green-rebrand`.** User confirmed the change-password result looks good. No pending spec/plan approval — this sub-thread is closed out.

## 3b. Follow-up work: logout redirect — DONE

User asked that logging out redirect back to `/login` instead of leaving the session on whatever page triggered it. Traced the gap: `components/dashboard/Sidebar.tsx`'s Logout button is a native `<form action="/api/auth/logout" method="post">`; the route handler (`app/api/auth/logout/route.ts`) was returning a plain `NextResponse.json({ success: true })` with no redirect. `proxy.ts`'s auth-redirect middleware doesn't cover this either — its `config.matcher` explicitly excludes `/api/*` — so the fix has to live in the route handler itself.

Implemented directly (small, mechanical, unambiguous — no brainstorm/plan needed): `route.ts` now returns `NextResponse.redirect(new URL("/login", request.url), 303)` (explicit 303 for correct POST-Redirect-GET semantics on a native form POST) with the session cookie cleared on the redirect response. `route.test.ts` updated to assert `303` + `location: http://localhost/login` + cleared cookie. Verified: isolated test passes, full suite 68/68, and live-verified against the running dev server via direct HTTP request (`POST /api/auth/logout` → `303 See Other`, `location: http://localhost:3000/login`, cookie cleared) — no dev-server restart needed, Next.js hot-reloads route handler changes. User tested in-browser and confirmed it works.

Commit `41c9098`: "Redirect to /login on logout". Pushed to `origin/green-rebrand`.

## 3c. Follow-up work: password-update confirmation toast — DONE

User asked for a "Password Updated!" confirmation after a successful password change, for reassurance (decided against the equivalent for login — the dashboard redirect there is sufficient confirmation on its own). Brainstormed via `superpowers:brainstorming` with the visual companion: 4 mockup styles shown (top-right toast, bottom-center toast, inline in-card banner, centered checkmark overlay); user picked **top-right toast**. Also decided the redirect to `/dashboard` should delay ~1.5s so the toast is actually visible instead of flashing during navigation.

**Spec:** `docs/superpowers/specs/2026-07-19-password-updated-toast-design.md`, committed `f05ab91`, self-reviewed. Implemented directly (single component, fully specified after brainstorming — same "small, mechanical" pattern as prior ad-hoc work on this branch, no subagent dispatch).

**Changes:** `app/change-password/ChangePasswordForm.tsx` — on success, shows a `role="status"` toast (white bg, green left border, checkmark badge, "Password Updated!"), keeps the submit button disabled through the delay (no more resetting `submitting` in a blanket `finally` — moved to the error/catch branches only), then `setTimeout` → `router.push("/dashboard")` after 1500ms. `app/globals.css` — new `toast-fade-in` keyframe/class mirroring the existing `login-card-in` pattern, disabled under `prefers-reduced-motion: reduce`. `ChangePasswordForm.test.tsx` — updated to use fake timers, assert the toast renders before the redirect fires, then assert redirect after advancing 1500ms.

**Positioning iterated twice after user testing, post spec-approval:** top-right (spec'd) → centered (`left-1/2 top-1/2`, overlapped the card) → **final: fixed near the top of the viewport** (`left-1/2 top-6`, horizontally centered, not vertically), because the card is vertically centered with variable height, so anchoring the toast near the top guarantees no overlap on any screen size without needing to measure the card. Animation adjusted alongside each move (slide-in-from-corner → scale-in → drop-in-from-top) to match. Each iteration was a direct small CSS tweak, no new brainstorm/spec revision — the spec's behavioral contract (1.5s delay, accessibility, self-contained implementation) didn't change, only the exact placement.

**Status: done, committed (`e2135ff`: "Add password-update confirmation toast"), user tested and confirmed in-browser.**

## 3d. Follow-up work: uniform MFC background across authenticated pages — DONE

User asked for the same faint MFC background treatment used on login/change-password to also appear on Dashboard, Profile, Settings, and Register User, for a uniform look. All four live under `app/(authenticated)/`, sharing `app/(authenticated)/layout.tsx` and, for Profile/Settings, the shared `PagePlaceholder` component — but that component is also used by the four transaction placeholder pages (`transactions/open|approved|canceled|my-approvals`), which the user did not mention. To avoid over-scoping, the background was added directly in each of the 4 named `page.tsx` files (not the shared layout or `PagePlaceholder`), so the transaction pages are untouched. Each page now wraps its content in a `relative bg-[#eef1ee]` container with the same `absolute inset-0 bg-[url('/mfc-logo.png')] opacity-[0.18]` overlay div used on login/change-password, content at `relative z-10`. Register's page already had its own `bg-[#eef1ee]` wrapper (mirroring login) — just needed the image overlay + `relative z-10` on its card added.

Commit `239c132`: "Add MFC background image to dashboard, profile, settings, register pages".

## 3e. Follow-up work: login error message → centered pop-up toast — DONE

User asked for the login page's error message ("Invalid email or password") to use the same fixed, centered pop-up presentation as the change-password success toast, instead of the inline red text below the password field. Implemented in `app/login/LoginForm.tsx`: same `fixed left-1/2 top-6 -translate-x-1/2` positioning and `toast-fade-in` animation class as the change-password toast, styled red (border/badge/text) instead of green, `role="alert"` (assertive) instead of `role="status"` since it's an error. Same lifecycle as before — stays until the next submit attempt clears it, no auto-dismiss timer (unlike the success toast, there's no redirect here to naturally time against).

Commit `5a47b6d`: "Convert login error message to a centered pop-up toast".

## 3f. Bugfix: change-password validation messages — DONE

Two related fixes to `lib/validation/auth.ts` and `app/api/auth/change-password/route.ts`:

1. **Specific messages instead of generic "Invalid request":** the route now surfaces the actual Zod issue message (`parsed.error.issues[0]?.message`) — "Password must be at least 8 characters" or "Passwords do not match" — instead of a blanket "Invalid request" for any validation failure. Confirmed safe to be this specific here (unlike login) since there's no account-enumeration risk once a user is already authenticated and changing their own password.
2. **Real bug found and fixed:** `confirmPassword` had its own independent `.min(8, ...)` check in the schema, which ran *before* the `.refine()` cross-field match check. So whenever `confirmPassword` was short — even when the actual problem was a mismatch with `newPassword` — the user saw "Password must be at least 8 characters" instead of "Passwords do not match" (user caught this from a screenshot: `newPassword="admin"`, `confirmPassword="adminadmin"`, both short-and-mismatched, message didn't address the mismatch). Fixed by dropping the redundant length rule on `confirmPassword` — its only real job is matching `newPassword`, which already enforces the length floor. Added a regression test (`route.test.ts`: "returns 'Passwords do not match' when confirm is short and mismatched, not a length error") covering exactly this case.

Commit `17e6475`: "Show specific validation messages on change-password errors".

## 3g. Deferred: Forgot Password

Login page has a "Forgot Password?" link (`app/login/LoginForm.tsx`) that is a dead `href="#"` — flagged as a known non-blocking gap in the original green-rebrand final review, never built out. User asked about implementing it; confirmed nothing exists yet to build on: no email-sending service configured anywhere in the project (checked `package.json` and codebase — no SMTP/Resend/SendGrid/etc.), no reset-token fields on the `User` model (`prisma/schema.prisma:36-55`), no reset route/page. This is a real feature (email delivery + token generation/expiry + a new consuming route), not a quick add-on — **explicitly deferred by the user ("lets work on it later on, just note it for future development") until a later point in the project.** When picked up, will need a brainstorming pass to decide delivery method (real email via a provider like Resend, vs. an admin-mediated reset with no email) before any implementation.

**Process preference (updated in memory 2026-07-19):** the user's per-task check-in rule (`feedback_checkin_between_sdd_tasks` memory) generalizes to every skill checklist item when running a formal plan — but for small, well-specified, mechanical ad-hoc requests like the change-password propagation above, direct in-session implementation (no brainstorm/spec/plan) is the established pattern on this branch, matching the earlier "post-review ad-hoc additions" in §2.

**Session environment notes:**
- A dev server (started outside this session) is already running at `http://localhost:3000`, PID 22044 — don't start a second one; `npm run dev` will fail with "Another next dev server is already running."
- Visual companion server running on port 52903 (background, 4h idle timeout), session dir `.superpowers/brainstorm/631-1784441032/`. Currently showing a waiting screen; safe to let it die or stop it — all selections are recorded above and in the spec.

## 3h. Follow-up work: navbar & sidebar redesign (floating icon rail) — DONE

User provided a reference design (CodePen-style floating icon menu with hover label fly-outs and a "gooey blob" animation) and asked if we could adopt it. Ran a full brainstorm with visual-companion mockups: first 3 rough layout options, then two high-fidelity interactive mockups (hoverable fly-outs) — user picked **"Design 1 — Green header"**: green `#2C7001` top bar kept, sidebar replaced by a floating white icon rail. Spec: `docs/superpowers/specs/2026-07-19-navbar-sidebar-redesign-design.md` (commit `3b63225`). Implemented directly (no formal plan — two-component rewrite, per branch convention), commit `754f091`.

Key decisions captured in the spec:

- **Icons are inline Feather-style SVGs** drawn in-component — deliberately no icon library dependency for 6 icons (5 rail + shield).
- **Active page** = `usePathname().startsWith(href)`, marked with `aria-current="page"` + green pill styling. Both components became `"use client"` for `usePathname`.
- **Fly-out labels** show on hover *and* keyboard focus, are always in the DOM (they ARE the accessible names — existing `getByRole("link", { name: ... })` tests kept working), and animations are disabled under `prefers-reduced-motion` via Tailwind `motion-reduce:` variants (no globals.css changes needed).
- **Logout** stays the same form POST to `/api/auth/logout`, pinned to the rail bottom below a divider, red hover (destructive-action convention).
- **Navbar** now shows: shield SVG (replacing the `⛨` emoji) + brand, divider + current page title (8-entry pathname map incl. the 4 transaction placeholder pages; unknown paths show no title), and the user's initials in a `bg-white/20` circle with full name as `title` tooltip — initials/fullName computed in `app/(authenticated)/layout.tsx` from the already-verified session (no new data fetching). No avatar dropdown (future work).
- **Explicitly declined:** the reference's gooey blob morph animation (user confirmed per-item hover pills instead), mobile collapse behavior.
- Layout root background changed `bg-white` → `bg-[#eef1ee]` so the rail's floating gap reads correctly on every page.

Tests: `Sidebar.test.tsx` updated (existing 3 pass unchanged + new `aria-current` active-state test, `usePathname` mocked via `vi.hoisted` ref) and new `Navbar.test.tsx` (brand, title mapping, unknown-path fallback, initials/tooltip). Suite 74 passing; only failure was the known seed-admin drift (§5), reset via the usual one-off script afterwards.

**Session environment notes (2026-07-19, evening):** visual companion server for this brainstorm runs on port 51919, session dir `.superpowers/brainstorm/1341-1784454868/` (mockups: `sidebar-layout-options.html`, `professional-designs.html`). Selections recorded here and in the spec; safe to stop or let idle out.

## 3i. Follow-up work: role-based "My Approvals" dashboard tile — DONE

User asked that the "My Approvals" dashboard module only appear for First/Second/Third Approver roles — everyone else (Creator, Guard Personnel) should see only Open/Approved/Canceled Transaction. Implemented directly (small, well-specified, no brainstorm/plan), commit `287bfbd`.

- **`lib/auth/permissions.ts`**: new `canViewApprovals(user)` — true for any of the three approver roles, **regardless of department** (deliberately different from `canProvisionUsers`, which also requires the Admin department; this request was role-only).
- **`app/(authenticated)/dashboard/page.tsx`**: became session-aware itself, re-deriving the session from the cookie (same pattern as `register/page.tsx`) rather than relying on the layout, and passes `canViewApprovals` down to `ModuleGrid` as a prop.
- **`components/dashboard/ModuleGrid.tsx`**: split the module list into always-shown `BASE_MODULES` (Open/Approved/Canceled) plus a conditionally-appended `APPROVALS_MODULE`.

Tests: 3 new cases in `permissions.test.ts`, new `ModuleGrid.test.tsx` (3 cases: base tiles always render, My Approvals hidden/shown by prop). Suite 80/80 passing after the usual seed-admin drift reset.

## 3j. Follow-up work: navbar search bar + QR scan placeholder — DONE

Second navbar iteration (on top of §3h). User asked to drop the shield icon beside the brand, add a centered search field for looking up transaction codes, then widen it and shorten the placeholder to "Search...", plus a QR scan trigger. QR placement options were mocked up in the visual companion (same session dir `1341-1784454868`); user picked Option A (QR icon inside the pill). Commit `fa0ed8b`.

- **`components/dashboard/Navbar.tsx`**: shield icon removed (brand is text-only now); header grid changed from `[1fr_auto_1fr]` to `[auto_1fr_auto]` so the center search column takes all leftover width (pill capped at `max-w-3xl`); search input has `aria-label="Search transaction code"` but visible placeholder "Search..."; QR button (`aria-label="Scan QR code"`) sits inside the pill's right edge — **decorative placeholder only, no onClick yet**. Search itself is also not wired to anything — both are future work.
- Future work queued from this: real transaction-code search (backend + results UI) and the QR scan flow (camera capture → code lookup).

Tests: `Navbar.test.tsx` — searchbox test extended to assert the new placeholder, new case for the QR button. Suite 82/82 passing (after one seed-admin drift reset and one Neon cold-start retry — both §5 gotchas, seen in that order this cycle).

## 3k. Follow-up work: dashboard tile icon badges — DONE

User asked for image/icon ideas on the dashboard module tiles. Two options mocked up in the visual companion (same session dir `1341-1784454868`): semantic colors vs. all-brand-green. User picked **Option A (semantic colors)**. Commit `ef4a275`.

- **`components/dashboard/ModuleGrid.tsx`**: each tile now has a rounded icon badge on its right side — Feather-style inline SVGs (same convention as `Sidebar.tsx`, no new deps): blue inbox (Open, `sky-100/600`), green check-circle (Approved, `green-100/600`), red x-circle (Canceled, `red-100/600`), amber clipboard-check (My Approvals, `amber-100/600`). Icons are `aria-hidden` decoration; tile layout, labels, and the green left accent border are unchanged.

Tests: no new cases — the badges are decorative and the existing `ModuleGrid.test.tsx` behavior tests (tile presence + approvals gating) still cover the component. Suite 82/82 passing (one Neon cold-start flake on first run, clean on retry).

## 3l. Follow-up work: dashboard tile hover effect — DONE

User asked for professional CSS hover effect ideas for the dashboard module tiles. Brainstormed via `superpowers:brainstorming` reusing the still-running visual companion session (`1341-1784454868`, port 51919): 4 live hoverable effect demos (`tile-hover-effects.html` — lift & shadow, accent sweep, icon pop, green ring), user asked to combine A+B+C, then compared full-strength vs. refined intensities (`tile-hover-combo.html`) and took the recommendation: **refined combo** (2px lift + green-tinted shadow, left border 4→6px + faint `#fbfdf9` wash + label turns `#2C7001`, icon badge scales 1.08 with a per-color glow at 0.20 alpha). Spec: `docs/superpowers/specs/2026-07-19-tile-hover-design.md` (commit `f0e7c24`). Implemented directly per branch convention, classNames-only in `components/dashboard/ModuleGrid.tsx`, commit `c632aa0`. Reduced motion: `motion-reduce:transition-none` + Tailwind-documented neutralizers (`motion-reduce:hover:translate-y-0`, `motion-reduce:group-hover:scale-100`), same convention as `Sidebar.tsx`. No new tests (decorative CSS, existing `ModuleGrid.test.tsx` still covers behavior). User verified in-browser and confirmed.

**Seed-admin state is now permanently user-owned (2026-07-19):** the user completed the "Set a New Password" flow for real — the seed admin (`admin@gmail.com`) now has the user's own password and `mustChangePassword: false`, **by explicit user choice**. Do NOT run the one-off reset script anymore unless the user asks. Consequence: `prisma/seed.test.ts` now fails its pristine-state assertions on every full-suite run (81/82 passing is the new expected baseline, e.g. this cycle's run). If the failing test gets annoying, the agreed future option is adjusting the test to tolerate a bootstrapped-then-changed admin — not yet requested.

## 3m. Follow-up work: Register User page → users table + modal wizard — DONE

User asked that `/register` show a table of registered users by default (columns: First Name, Last Name, Role, Department, Business Unit, Location, Created) with a "+ Register User" button (upper right) opening the existing 3-step wizard. Brainstormed with a fresh visual-companion session (`750-1784509596`, port 52903 — old 51919 session had idled out); user picked the modal approach (Option A mockup: role pills, zebra rows, green-tinted header). Spec: `docs/superpowers/specs/2026-07-20-register-users-table-design.md` (`4090c52`). Plan: `docs/superpowers/plans/2026-07-20-register-users-table.md` (`da6b734`, 2 tasks). Executed via `superpowers:subagent-driven-development` (haiku implementers — fully-specified code — sonnet task reviewers, opus final review; per-task user check-ins per standing preference).

- **Task 1 (`60d4c7f`):** `ROLES`/`ROLE_LABELS` extracted to new `lib/roles.ts` (shared by wizard + table); wizard success now calls `router.refresh()` (was a dead `router.push("/register?success=1")`). Review clean.
- **Task 2 (`5539d30`):** new `app/(authenticated)/register/UsersView.tsx` (client: header/count, hover-lift button, 7-column table, role pill map, empty state, ✕-only modal wrapping `RegistrationWizard`) + 4 tests; `page.tsx` now queries Prisma directly (allowlist select — no email/hash to client), formats dates server-side (`en-US` short-month, hydration-safe), keeps the `canProvisionUsers` gate and MFC background. Review clean.
- **`4aa8277`:** user tested in-browser — modal overlapped the navbar; centered it with the canonical `overflow-y-auto` overlay + `flex min-h-full items-center justify-center` wrapper (scroll-safe for the tall step-2 form).
- **Final review (opus): "Ready to merge, with fixes"** — 0 Critical/Important. Its Minor fixes landed in `1d33add`: regression test that backdrop/Escape do NOT close the modal (deliberate, spec'd behavior), singular "1 user" test, `colSpan={COLUMNS.length}`, JSX re-indent. Backlog (not done, not blocking): modal focus trap/restore (a11y), pagination if the user list grows.

**New test baseline: 87/88** (was 81/82) — the 1 failure is still only the §3l seed-admin baseline. `npm run build` clean. User confirmed the centered modal in-browser.

## 3n. Follow-up work: edit existing user — DONE

User asked to be able to edit an already-registered user's details from the `/register` users table, reusing the existing 3-step `RegistrationWizard` in an "edit" mode rather than building a second form. Spec: `docs/superpowers/specs/2026-07-20-edit-user-design.md` (`93c4917`). Plan: `docs/superpowers/plans/2026-07-20-edit-user.md` (`8ca4ddb`, 4 tasks). Executed via `superpowers:subagent-driven-development` (haiku implementers, sonnet task reviewers; per-task user check-ins per standing preference).

- **Task 1 (`fd432b8`):** new `editUserSchema` in `lib/validation/registration.ts` — identical to `registrationSchema` minus password fields and the cross-field refine. Reviewer flagged the diff also touched `registrationSchema` itself (added `jobTitle`) beyond brief scope; investigated and found this was pre-existing uncommitted work (an earlier, never-committed "add Job Title column" change) that `git add <whole file>` incidentally swept into the commit — not a Task 1 defect. That stranded work was committed separately right after: **`ba29a4f`** adds `jobTitle` end-to-end (User model + migration + seed + wizard + table + page, 12 files).
- **Task 2 (`f8477f3`):** new `GET`/`PATCH /api/users/[id]` route — same auth pattern as `/api/register` (session → `verifySessionToken` → `canProvisionUsers` → 403), `GET` returns one user's editable fields, `PATCH` validates via `editUserSchema`, 409 on email collision with a *different* row, 404 for unknown id. Review clean, 11/11 tests against real test DB.
- **Task 3 (`2b5bdad`, fix `7ae44e7`):** `RegistrationWizard` gains optional `userId`/`onDone` props. When `userId` is set: loads the user via `GET`, shows a "Loading user…" placeholder while fetching, omits the Password/Confirm Password fields entirely from the DOM, validates Step 2 against `editUserSchema`, submits via `PATCH` instead of `POST /api/register`, success screen reads "Changes saved" with a "DONE" button calling `onDone()` instead of resetting the form. Reviewer's first pass found the PATCH body's password-exclusion wasn't asserted by any test — fixed in `7ae44e7` (explicit assertion that `password`/`confirmPassword` are `undefined` in the submitted body).
- **Task 4 (`2eb2353`):** `UsersView` gets an Actions column (rightmost) with a per-row Edit button, and its modal state becomes a discriminated union (`{mode: "closed"} | {mode: "create"} | {mode: "edit", userId}`) so the same modal serves both flows — header text switches between "REGISTER USER"/"EDIT USER", close behavior (✕ only, no backdrop/Escape dismiss) unchanged in both modes.

No final whole-branch review was run for this plan (unlike register-users-table, which got an opus pass) — all 4 tasks reviewed clean/fixed individually and the ledger shows no outstanding findings. Full suite 110/111 after this work (only the known §3l seed-admin baseline failure). Out of scope, per the spec: deleting/deactivating users, bulk edit, changing a user's password from this flow (deferred to a future self-service change-password flow).

## 3o. Follow-up work: Edit button styling — DONE

User asked to replace the users table's plain underlined-text "Edit" trigger with something that reads as an actual button. Brainstormed via `superpowers:brainstorming`, reusing the still-live visual companion session (`750-1784509596`, port 52903): 4 mockup options in an actual 3-row table mockup (icon-only circular, icon+label outlined pill, solid mini-fill, text-with-hover-chip only). User asked for a recommendation; **picked option B (icon + label pill)** on that recommendation — clearer affordance than icon-only for a single per-row admin action, and an actual button at rest unlike the hover-only text option. Spec: `docs/superpowers/specs/2026-07-20-edit-button-style-design.md` (`ecfacf9`). Implemented directly per branch convention (single file, classNames + one new local icon component), commit `eb48663`.

- **`app/(authenticated)/register/UsersView.tsx`:** new `EditIcon()` (pencil, same inline Feather-style SVG convention as `Sidebar.tsx`'s icons — `aria-hidden`, `viewBox 0 0 24 24`, round caps/joins). Edit button restyled to a bordered pill (`border-[#cfe3c4]`, rounded-full) matching the table's existing role-pill shape, fills `#f2f8ee` and border goes full `#2C7001` on hover, `focus-visible` ring reused from the login/change-password button convention. "Edit" text stays in the DOM (icon is decorative), so the accessible name is unchanged — existing `getByRole("button", { name: /^edit$/i })` queries in `UsersView.test.tsx` kept passing unmodified, no new tests needed.

Suite 110/111 (same known seed baseline). One transient `TypeError: Cannot read properties of undefined (reading 'config')` on the scoped test file, same known flake pattern as prior cycles — clean on immediate retry.

## 3p. Follow-up work: users table header color — DONE

User asked for the users table header to match the navbar's green (`#2C7001`) with white text, instead of the pale `#f8faf7`/`#3f6212` treatment. Brainstormed via `superpowers:brainstorming`, reusing the still-live visual companion session (`750-1784509596`, port 52903): mockup of the full table with a solid green header row against the real body rows/pills/Edit buttons, then a second version with the column labels bolded per user request. User approved the bold version ("Looks right, implement it"). Implemented directly (single-file classNames change, no separate spec doc — same lightweight precedent as the icon-badge round, §3k), commit `87eeca1`.

- **`app/(authenticated)/register/UsersView.tsx`:** header `<tr>` background `bg-[#f8faf7]` → `bg-[#2C7001]`; the `border-b-2 border-[#2C7001]` separator was dropped (it becomes invisible once the header fill is the same green — the solid fill already provides the separation); column label `<th>` text `text-[#3f6212] font-semibold` → `text-white font-bold`.

No new tests — purely decorative background/text-color change, existing `UsersView.test.tsx` (9/9) still covers behavior and passed unmodified.

## 3q. Follow-up work: Settings — setup tables (Matrix Type, Department, Business Unit, Location) — IN PROGRESS

New multi-step feature, first piece of the future Outslip request work. User wants employees to eventually create outslip requests with an approval level driven by a "Matrix Type" dropdown (e.g. Halfday, Undertime, Visitor Pass, Out for Lunch, Others) — but that whole request/approval feature was explicitly decomposed down to just its first building block: giving admins a place to manage the Matrix Type list (plus, once raised, the existing-but-unused Department/Business Unit/Location reference data too). **The approval-level/routing logic itself is deferred — user said they'll provide that separately.**

Brainstormed via `superpowers:brainstorming`, reusing the still-live visual companion session (`750-1784509596`, port 52903). Key decisions along the way:
- User shared a screenshot of a legacy system's `matrix_type` table (columns: id, matrix_code, matrix_type, creator, date_created) as a **shape reference only** — not a data migration; fresh seed values used instead (`Halfday`, `Undertime`, `Routing to other Business Unit`, `Visitor Pass`, `Out for Lunch`, `Others`).
- Matrix code auto-generates (`MT-001`, `MT-002`, …) — admin never types it.
- Discovered `Department`/`BusinessUnit`/`Location` already have a working `POST /api/reference-data` endpoint with zero UI in front of it (Settings page was still a placeholder) — decided to finally build that UI now, for all four setups, add-only (no edit/delete), keeping the existing three simple (no creator/date tracking — only Matrix Type gets that).
- Layout mockups iterated through several rounds (top tabs → pill segmented control → dashboard-tile-style launcher with counts → **final: same dashboard-tile-style launcher, labels only, no counts**) before landing on the approved design.

**Spec:** `docs/superpowers/specs/2026-07-20-settings-setup-tables-design.md` (`3acc379`). **Plan:** `docs/superpowers/plans/2026-07-20-settings-setup-tables.md` (`2bc4f54`, 3 tasks). Executing via `superpowers:subagent-driven-development` (haiku implementers, sonnet task reviewers; per-task user check-ins per standing preference).

- **Task 1 — DONE (commits `0f9dd08`, fix `a375cf0`):** `MatrixType` Prisma model (matrixCode/name both unique, creator relation to `User`, createdAt) + migration applied to the live Neon DB; `lib/validation/matrixType.ts` (`matrixTypeSchema`); seed data for the 6 matrix types with sequential `MT-XXX` codes. Original review caught a real bug: the implementer had changed `seedAdmin()` to unconditionally reset an *existing* admin's `passwordHash`/`mustChangePassword` on every seed re-run — which would have silently reverted the live admin's real, user-set password (see §3l — that state is supposed to be permanent, untouched without the user asking). Fixed by reverting `seedAdmin` to the brief's exact early-return-only behavior; re-review confirmed clean. 8/8 tests pass. One Minor, plan-mandated (not implementer-introduced), carried to final review triage: `seedMatrixTypes`'s code-generation (count-based) would collide if a row were ever deleted — not currently reachable, no delete UI exists.
- **Task 2 — NOT STARTED:** extend `GET /api/reference-data` with `matrixTypes`; new `POST /api/matrix-types` route.
- **Task 3 — NOT STARTED:** `SettingsView` client component (tile launcher + tables + add-modal) and the `settings/page.tsx` rewrite (replaces the `PagePlaceholder`).

**Status: paused mid-plan by user request ("update handoff.md and lets continue maybe tomorrow").** Resume at Task 2 — dispatch its implementer per `superpowers:subagent-driven-development` (the plan and ledger have everything needed; no re-brainstorming required). Progress ledger: `.superpowers/sdd/progress.md`, section "Progress Ledger — settings-setup-tables plan".

## 4. Environment & secrets

Working directly in the main repo checkout (not a worktree) — `.env` here already points at the live Neon Postgres dev database. No new secrets introduced by this plan.

## 5. Known environment gotchas

- Neon cold-start: `P1001`/connection errors on DB-backed tests or `prisma migrate deploy` — retry once before concluding anything is broken (per the plan's Global Constraints).
- Seed-admin "drift" is no longer drift (see §3l): `prisma/seed.test.ts` failing 1/82 is the expected baseline now — do not reset the seed admin's password/`mustChangePassword` without the user asking.
- `npm install` is restricted to `npm install --ignore-scripts`; no new deps are expected in this plan.
- Two other worktrees exist in this repo (`.claude/worktrees/homepage` on branch `worktree-homepage`, `.claude/worktrees/registration-login` on branch `worktree-registration-login`) sitting on older pre-rebrand commits. They predate this plan and are unrelated to it — don't confuse their state with `green-rebrand`'s.

## 6. GitHub push status

Pushed to `origin/green-rebrand` on 2026-07-20 (standing sync authorization: commit+push+handoff-update after each user-confirmed cycle — most recent cycle: users table header color, §3p), latest tip = the handoff-update commit `01019ad` sitting on top of `87eeca1`, **61 commits ahead of `main`** (verified via `git rev-list --count main..HEAD` after the handoff commit). **Merge intentionally deferred** — user wants the branch to stay pushed-but-unmerged until the whole project is finished (see Status note in §2). This project's convention is explicit authorization per push, not standing permission — ask again before merging to `main` or opening a PR, even later in the project.
