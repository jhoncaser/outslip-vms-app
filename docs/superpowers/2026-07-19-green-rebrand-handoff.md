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

## 3. Follow-up work in flight: login page polish (started 2026-07-19, after plan completion)

New mini-project on this same branch, currently mid-brainstorm-workflow. User asked for CSS polish on the login page (button hover effects, text hierarchy, card design). Brainstormed via `superpowers:brainstorming` with the visual companion (browser mockups); user's final selections:

- **Button:** effect A — "Lift & shadow" hover/press (darken + 2px rise + green shadow, focus-visible ring, motion-reduce and disabled handling)
- **Text:** option A — "SIGN IN" stays the only `<h1>` unchanged; subtitle bumped `text-xs text-slate-400` → `text-[13px] text-slate-500`
- **Card polish:** item 2 only — CSS entrance animation (fade + 16px rise, 400ms, `prefers-reduced-motion` disabled). Declined: shadow rework, input focus transition, Forgot-Password hover, mixed-case heading, brand eyebrow.

**Scope: login page only** (`app/login/LoginForm.tsx`, `app/login/page.tsx`, `app/globals.css`). User will test before deciding whether to propagate to change-password.

**Spec:** `docs/superpowers/specs/2026-07-19-login-polish-design.md`, committed `5309a5a`, self-reviewed.

**Exact resume point: awaiting the user's review/approval of that spec.** Once approved, the next checklist item is invoking `superpowers:writing-plans` — do NOT skip ahead to implementation, and do NOT re-brainstorm.

**Process preference (updated in memory 2026-07-19):** the user generalized their per-task check-in rule to *every skill checklist item* — complete one item, report, wait for explicit go-ahead before the next (`feedback_checkin_between_sdd_tasks` memory).

**Session environment notes:**
- A dev server (started outside this session) is already running at `http://localhost:3000`, PID 22044 — don't start a second one; `npm run dev` will fail with "Another next dev server is already running."
- Visual companion server running on port 52903 (background, 4h idle timeout), session dir `.superpowers/brainstorm/631-1784441032/`. Currently showing a waiting screen; safe to let it die or stop it — all selections are recorded above and in the spec.

## 4. Environment & secrets

Working directly in the main repo checkout (not a worktree) — `.env` here already points at the live Neon Postgres dev database. No new secrets introduced by this plan.

## 5. Known environment gotchas

- Neon cold-start: `P1001`/connection errors on DB-backed tests or `prisma migrate deploy` — retry once before concluding anything is broken (per the plan's Global Constraints).
- `npm install` is restricted to `npm install --ignore-scripts`; no new deps are expected in this plan.
- Two other worktrees exist in this repo (`.claude/worktrees/homepage` on branch `worktree-homepage`, `.claude/worktrees/registration-login` on branch `worktree-registration-login`) sitting on older pre-rebrand commits. They predate this plan and are unrelated to it — don't confuse their state with `green-rebrand`'s.

## 6. GitHub push status

Pushed to `origin/green-rebrand` on 2026-07-19 (user explicitly authorized: "we can proceed and push this to my github"), latest tip `a92bc2b`, 10 commits ahead of `main` (`972e2c0..a92bc2b`). **Merge intentionally deferred** — user wants the branch to stay pushed-but-unmerged until the whole project is finished (see Status note in §2). This project's convention is explicit authorization per push, not standing permission — ask again before merging to `main` or opening a PR, even later in the project.
