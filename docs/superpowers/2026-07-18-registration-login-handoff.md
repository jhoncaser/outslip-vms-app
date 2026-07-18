# Registration & Login — Handoff

**Branch:** `worktree-registration-login` (worktree at `.claude/worktrees/registration-login`)
**Spec:** `docs/superpowers/specs/2026-07-18-registration-login-design.md`
**Plan:** `docs/superpowers/plans/2026-07-18-registration-login.md` (16 tasks)
**Ledger:** `.superpowers/sdd/progress.md` (gitignored, scratch — per-task detail behind each line below)

## 1. Execution mode

Subagents in this environment cannot run `npm`/`git` (sandbox denies them), so this is **not** being built via subagent-driven-development. Per explicit user instruction, tasks are executed inline in this session, one at a time, with a checkpoint summary posted after each task. Wait for user go-ahead before starting the next task — do not batch ahead.

## 2. Progress status

**Done (Tasks 1-15, commits `41dd678`..`8761368`):**

| Task | What | Commit |
|---|---|---|
| 1 | Next.js/Tailwind/Vitest scaffold | `235209b` |
| 2 | Prisma schema + Neon migration + client singleton | `2f785de` |
| 3 | Seed script (reference data + bootstrap admin) | `e82e93d` |
| 4 | Password hashing (`bcryptjs` wrapper) | `11dc0e4` |
| 5 | Session JWT utility (`jose`) | `0350744` |
| 6 | Permission helpers (`canManageReferenceData`/`canProvisionUsers`) | `2bb8aae` |
| 7 | Zod validation schemas (auth/registration/referenceData) | `6820406` |
| 8 | Route guard logic + `middleware.ts` | `a2399aa` |
| 9 | Login API route (`POST /api/auth/login`) | `0953169` |
| 10 | Login page UI | `9f6d24f` |
| 11 | Change-password route + page | `8a82402` |
| 12 | Reference-data API route | `177dc30` |
| 13 | Register API route | `4601c6e` |
| 14 | Registration wizard UI | `45ae200` |
| 15 | Dashboard placeholder + logout + starter homepage replaced | `8761368` |

Full test suite currently: **59/59 passing** (see §5 for a flakiness note — occasional Neon connection retries needed, not a real regression).

**Remaining:**
- Task 16: End-to-end manual verification
- Final whole-branch code review
- `superpowers:finishing-a-development-branch`

## 3. Deviations from the plan so far

The plan's verbatim code was written against a slightly different tool-version baseline than what's actually installed, plus a couple of places where the plan's code snippet didn't fully match the mockup it was supposed to implement. Every deviation below was necessary to make the plan's intended behavior work, not a scope change:

- **Prisma pinned to 6.19.2** (`@prisma/client` and `prisma` CLI). An unpinned install pulls 7.x, which requires driver adapters (`new PrismaClient({ adapter })`) and breaks the plan's `new PrismaClient()` calls throughout.
- **`prisma/seed.ts`**: guarded the top-level `main()` self-invocation with `if (process.argv[1] === fileURLToPath(import.meta.url))` — the plan's unconditional version fired on import and disconnected Prisma mid-test when `seed.test.ts` imports `{ main }`.
- **`vitest.config.ts`**: `testTimeout` raised to 20s globally — live-Neon round trips (esp. the seed script's ~15 sequential upserts) exceed Vitest's 5s default, especially through Neon cold starts.
- **`jose`/jsdom realm mismatch**: any test file that calls `createSessionToken`/`verifySessionToken` needs `// @vitest-environment node` at the top. Under the suite's default jsdom environment, `TextEncoder` returns a `Uint8Array` from a different global realm than `jose`'s `instanceof` check expects, throwing `TypeError: payload must be an instance of Uint8Array` on `.sign()`. Applied to every test file so far that touches session tokens: `lib/auth/session.test.ts`, `app/api/auth/login/route.test.ts`, `app/api/auth/change-password/route.test.ts`, `app/api/reference-data/route.test.ts`, `app/api/register/route.test.ts`. **Apply the same fix to any future test that imports `createSessionToken`/`verifySessionToken` directly** (not needed for `app/api/auth/logout/route.test.ts` — it only imports the `SESSION_COOKIE_NAME` constant, no jose calls).
- **Task 14's `RegistrationWizard.tsx`**: the plan's verbatim snippet omits UI elements that `registration-final.html` clearly specifies — the 3-circle step-progress indicator (numbered/checkmark states connected by lines) and the per-step headings ("Select your role" / "Personal & account details"). Added both on top of the plan's verbatim logic/state/handlers, without touching any id/label/role the test queries against. Did **not** attempt to replicate the mockup's 3-column field grid on step 2 — kept the plan's simpler stacked layout; judged the step indicator/headings as the load-bearing fidelity gaps and the column layout as lower-priority polish.

No other code deviations — all other tasks' plan code worked verbatim.

### Process note (not a plan deviation, but worth knowing)

`.superpowers/brainstorm/1218-1784345160/content/` (the mockup source referenced by Tasks 10 and 14) was **not present in this worktree** when Task 10 started — it's untracked scratch state in the main repo working tree, and `git worktree add` only carries committed files, not untracked ones. It was copied manually into the worktree at the same relative path before Task 10 began. It's there now (`login-final.html`, `registration-final.html`, `login-layout.html`, `register-layout.html`, `visual-style.html`, `waiting.html`), so this is resolved and shouldn't recur — but if a *new* worktree is ever created for follow-on work, check this path exists before assuming a mockup is available.

## 4. Environment & secrets

`.env` (gitignored, already populated in this worktree — not committed):
- `DATABASE_URL` — Neon Postgres connection string (already seeded with reference data + one bootstrap admin user)
- `JWT_SECRET`
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — bootstrap admin login (role `FIRST_APPROVER`, department `Admin`, `mustChangePassword: true`)

`.env.example` is committed as the template. Tests run against the **live Neon database** — no test DB, no mocking, per the plan's explicit design.

**The seed admin account's password has deliberately never been changed** during Tasks 10-15's manual verification, even though several of those steps (Task 11, Task 14) would naturally have wanted to log in as the seed admin post-password-change. Instead, disposable throwaway users were created directly via one-off Prisma scripts for manual browser verification, then deleted afterward. Reason: the seed script (`prisma/seed.ts`) is only idempotent for *creating* the admin — if it already exists, `seedAdmin()` no-ops and does **not** reset a changed password or `mustChangePassword` flag. Task 16 Step 4 explicitly wants to log in with the original `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and hit the forced-password-change flow for the first time — that only works if nothing has touched this account yet. **Task 16 is the first task that's supposed to actually change the seed admin's password** — that's fine and expected there, it's the end of its walkthrough, not a concern to work around.

## 5. Known environment gotchas

- **Neon cold starts**: the first DB round trip in a fresh run (whether `vitest run` or the dev server's first live request) occasionally throws a `P1001`/`PrismaClientInitializationError` ("Can't reach database server"). Not a real failure — retry the same command and it passes. Seen repeatedly across Tasks 2, 3, 9, and again on the dev server's first request in Task 15.
- **Full-suite flakiness scales with suite size**: as of Task 15 (17 test files, 59 tests), a full `npx vitest run` occasionally needs 2-3 retries before a clean pass, each time failing a *different*, unrelated DB-touching test file with the same P1001-style error — likely Neon connection-pool pressure from more test files running concurrently, not a real regression. Budget for this when running the full suite in Task 16.
- **Stray `next dev` processes on Windows/Git Bash**: `npm run dev` backgrounded via Bash (or via the harness's background-task runner) does not expose the real listening process's PID — it's a child/grandchild, and even the harness's own task-stop does not reliably kill it. Fix: check `Get-NetTCPConnection -LocalPort 3000 -State Listen` (PowerShell) for the real owning PID, then `Stop-Process -Id <pid> -Force`. Always verify port 3000 is clear after any manual-verification step that starts a dev server. Hit this after every single manual-verification step in Tasks 10, 11, and 14-15 — expect it every time.
- **`npm install` scripts are restricted**: machine-level `.npmrc` allows install scripts only for `@anthropic-ai/claude-code`. Use `npm install --ignore-scripts` for any new package installs.
- **httpOnly session cookies can't be cleared via page JS**: when manually testing in a browser via Playwright and you need to switch users (e.g., log out an old session to log in as someone else) but the logout route doesn't exist yet or you don't want to use it, `page.context().clearCookies()` (via the Playwright automation layer, not `document.cookie` in-page) is the way to clear the httpOnly `session` cookie.

## 6. How to resume

1. Read this file and `.superpowers/sdd/progress.md` for what's done.
2. Read Task 16 in `docs/superpowers/plans/2026-07-18-registration-login.md` (search `### Task 16:`) — it's the full end-to-end manual walkthrough: run the full suite, re-seed, start the dev server, and walk through the entire bootstrap flow in a browser (seed admin login → forced password change → dashboard → register a new user via the wizard → sign out → log in as the new user → forced password change → confirm non-Admin users can't reach `/register`), then confirm no secrets are committed (`git status`, `git log --all -- .env`).
3. This is the last plan task. After it passes, the plan calls for a **final whole-branch code review**, then **`superpowers:finishing-a-development-branch`** to wrap up.
4. Unlike Tasks 10-15, Task 16 is explicitly supposed to use the real `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` account and change its password for real as part of the walkthrough — see §4, this is the intended first use of that account beyond login-only checks.

**REMINDER for whoever resumes this:** don't treat Task 16 as just "click through the plan's Step 4 checklist and call it done." Before wrapping up:
- Do the full testing the plan's Step 1 asks for (`npx vitest run`, expect all green — budget for the Neon-retry flakiness noted in §5) **and** the full manual browser walkthrough in Step 4, not just one or the other.
- While doing that walkthrough, actively look for bugs beyond the plan's literal checklist — edge cases the automated tests don't cover (e.g. what a 500 response does to `LoginForm`'s `response.json()` call, double-submit behavior, back-button behavior mid-wizard, etc.), not just the happy path the plan spells out.
- Explicitly check for security issues before calling this done — this is an auth/registration/permissions feature, so it deserves a real pass, not an assumption that "tests pass" means "secure." At minimum: re-verify server-side permission checks can't be bypassed by calling the API routes directly (Tasks 12/13's tests cover some of this, but double check with fresh eyes), check cookie flags (`httpOnly`/`secure`/`sameSite`) are actually right for how this will be deployed, confirm no secrets/PII leak into error responses or logs, and sanity-check the password/session/JWT handling in `lib/auth/` one more time end-to-end now that all the pieces are wired together (not just unit-tested in isolation).
- If anything turns up — bug or security concern — fix it (or at minimum flag it clearly to the user) before treating Task 16 as complete, rather than deferring it silently to "someday."
