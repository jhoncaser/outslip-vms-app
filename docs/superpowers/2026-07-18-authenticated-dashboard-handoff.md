# Authenticated Dashboard Shell — Handoff

**Branch:** `worktree-homepage` (worktree at `.claude/worktrees/homepage`), forked from `worktree-registration-login` @ `61b09fc` (not from `main` — this work depends on the login/session/permissions code, which isn't merged to `main` yet)
**Spec:** `docs/superpowers/specs/2026-07-18-authenticated-dashboard-design.md`
**Plan:** `docs/superpowers/plans/2026-07-18-authenticated-dashboard.md` (10 tasks)
**Ledger:** `.superpowers/sdd/progress.md` (gitignored, scratch — per-task detail behind each line below)

## 1. Execution mode

Being built via **`superpowers:subagent-driven-development`** (fresh implementer subagent per task, then a task-reviewer subagent, per the plan's 10 tasks). Deviation from that skill's default: **per explicit user instruction, stop and report after every task (implementer done + review clean + ledger updated) and wait for an explicit go-ahead before dispatching the next task's implementer.** Do not batch ahead through multiple tasks autonomously. (This preference is saved in memory as `feedback_checkin_between_sdd_tasks` for future sessions too.)

Model selection used so far: implementers on `haiku` (the plan's tasks all contain complete, verbatim code — transcription + testing, not design judgment), task reviewers on `sonnet`. The final whole-branch review (after Task 10) should go on the most capable available model per the skill's guidance (`opus`), not `sonnet`.

## 2. Progress status

**Done (Tasks 1-3, commits `69f1985`..`ccff7d1`), each reviewed clean:**

| Task | What | Commit | Review |
|---|---|---|---|
| 1 | `Theme` enum + `User.themePreference` field + migration | `d58d656` | ✅ clean |
| 2 | Tailwind v4 class-based dark variant in `app/globals.css` | `2c302d8` | ✅ clean |
| 3 | `PATCH /api/user/theme` route (+ Zod schema + integration test) | `ccff7d1` | ✅ clean (2 Minor notes, both pre-existing codebase patterns, not defects — see `.superpowers/sdd/progress.md`) |

**Out-of-plan fix, done in between Task 2 and Task 3:** `npm run build` was failing on a pre-existing TypeScript error in `app/api/reference-data/route.ts:51` (calling `.create()` on a variable typed as a union of Prisma delegates isn't type-checkable). Confirmed via direct testing that this bug predates all of this plan's work — it already existed on `worktree-registration-login` before this worktree was even created, just never caught because earlier work only ran `vitest`, never a full `next build`. Fixed at the source: commit `14f773f` on `worktree-registration-login`, then cherry-picked into `worktree-homepage` as commit `c8fe47d`. `npm run build` is clean on both branches now.

**Remaining:**
- Task 4: `ThemeShell` (context/provider) + `ThemeToggle` (persist button) + `Navbar`
- Task 5: `Sidebar` (permission-gated Register User link)
- Task 6: `PagePlaceholder` + 6 placeholder pages (Profile, Settings, 4 transaction views)
- Task 7: `ModuleGrid` + move `app/dashboard` into `app/(authenticated)/`
- Task 8: Move `app/register` (+ wizard files) into `app/(authenticated)/`
- Task 9: `app/(authenticated)/layout.tsx` wiring it all together + test
- Task 10: Full verification (`vitest run`, `npm run build`, dev server handoff for live browser testing)
- Final whole-branch code review (dispatch on `opus`)
- `superpowers:finishing-a-development-branch`

## 3. How to resume

1. Read this file and `.superpowers/sdd/progress.md` for what's done — **do not re-dispatch Tasks 1-3, they're complete and reviewed.** Trust the ledger + `git log` over anything else.
2. Re-invoke `superpowers:subagent-driven-development` (or just continue directly — the pattern is established): `scripts/task-brief docs/superpowers/plans/2026-07-18-authenticated-dashboard.md 4`, dispatch the Task 4 implementer (`haiku`, complete code already in the plan), then `scripts/review-package <base> <head>` + task reviewer (`sonnet`) once it reports DONE.
3. **Check in with the user after Task 4 completes — do not proceed to Task 5 without their go-ahead** (see §1).
4. Continue one task at a time through Task 10, then the final whole-branch review, then `finishing-a-development-branch`.

## 4. Environment & secrets

`.env` already exists in this worktree (copied from `worktree-registration-login`, gitignored, not committed) — same live Neon Postgres dev database as the registration-login work, same `JWT_SECRET`, same `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (though the live admin's actual password has since been changed through the app by the user — see the registration-login handoff §4 for why `prisma/seed.test.ts`'s `mustChangePassword` assertion is expected to fail, not a regression).

Dependencies installed with `npm install --ignore-scripts` (machine-level `.npmrc` restriction — see registration-login handoff §5), then `npx prisma generate` run manually since `--ignore-scripts` skips Prisma's postinstall codegen.

## 5. Known environment gotchas

All gotchas from `docs/superpowers/2026-07-18-registration-login-handoff.md` §5 apply here too (Neon cold starts / retry-once; full-suite flakiness scales with test count; stray `next dev` PID on Windows — find via PowerShell `Get-NetTCPConnection -LocalPort 3000 -State Listen`, not the backgrounded shell's reported PID; `npm install --ignore-scripts` restriction). Not repeating them in full here — read that file's §5 if a fresh session hits any of these.

New to this worktree:
- **`npm run build` (not just `vitest run`) matters for this plan** — Task 2 surfaced a real pre-existing TypeScript error that `vitest` never caught (see §2's out-of-plan fix). Run `npm run build` periodically during the remaining tasks, not just at the very end in Task 10, so a new type error doesn't sit undetected across multiple tasks.
- `review-package` and `task-brief` (from the `subagent-driven-development` skill's `scripts/` dir) resolve paths relative to the shell's current working directory — always confirm `pwd` is `.claude/worktrees/homepage` before running them. Mid-session, a `cd` into `worktree-registration-login` (for the build-fix verification) caused one review-package file to be written into the wrong worktree; caught and regenerated in the right place. Worth double-checking output paths after any command that jumps between worktrees.

## 6. Uncommitted state to be aware of (not from this plan's work)

`worktree-registration-login` currently has **two small uncommitted edits**, unrelated to anything in this plan, first observed at commit-time ~17:46-47 (before this dashboard-shell work started, so not something introduced by Tasks 1-3 or the build fix):
- `app/layout.tsx`: metadata description `"Outslip Visitor Monitoring System"` → `"Outslip & Visitor Monitoring System"`
- `app/register/page.tsx`: brand text `"OUTSLIP VMS"` → `"OUTSLIP AND VMS"`

These look like manual copy edits (possibly made directly in the editor), not something from any subagent or plan task. Left untouched and uncommitted — worth asking the user whether these were intentional before either committing or discarding them.

## 7. GitHub push status

Neither `worktree-homepage`'s new commits nor `worktree-registration-login`'s new build-fix commit (`14f773f`) have been pushed to GitHub yet as of this handoff. `worktree-homepage` has no upstream branch configured yet (it was only ever created locally). Ask the user before pushing either — pushing is something they've explicitly asked for each time in this project so far, not standing authorization.
