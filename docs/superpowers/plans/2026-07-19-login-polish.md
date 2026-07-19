# Login Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button hover/press effect, a subtitle contrast fix, and a card entrance animation to the login page — pure CSS/className changes, no logic touched.

**Architecture:** Three independent visual tweaks on the same three files (`LoginForm.tsx`, `page.tsx`, `globals.css`). All are className/CSS-only, verified by the existing automated suite (no new tests needed, since no test asserts on className or animation) plus a manual browser pass.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS v4 (`@theme inline` in `app/globals.css`), Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-login-polish-design.md`.
- Scope is login page only: `app/login/LoginForm.tsx`, `app/login/page.tsx`, `app/globals.css`. Do not touch `app/change-password/page.tsx` or any other page.
- No colors, palette, gradient header, background image, layout/structure, or text content may change (wording is byte-identical throughout).
- No form logic changes — `LoginForm.tsx`'s `handleSubmit`, state, and JSX structure outside the button's `className` attribute are untouched.
- `npx vitest run` must stay green at 68/68 after the change (baseline from the last full-branch verification in the handoff).
- All motion (button lift, card entrance) must be disabled under `prefers-reduced-motion: reduce`.

---

### Task 1: Apply login page polish (button hover, subtitle, card entrance animation)

**Files:**
- Modify: `app/login/LoginForm.tsx:88-94` (submit button `className`)
- Modify: `app/login/page.tsx:10` (card container `className`), `app/login/page.tsx:25` (subtitle `className`)
- Modify: `app/globals.css` (append keyframes + animation class at end of file, after line 19)
- Test: `app/login/LoginForm.test.tsx` (existing file, run as-is — no changes needed)

**Interfaces:**
- Consumes: nothing from other tasks (this is a standalone, single-task plan).
- Produces: nothing consumed elsewhere — this is the final task.

- [ ] **Step 1: Update the login button's className for the "Lift & shadow" hover/press effect**

In `app/login/LoginForm.tsx`, find the submit button (currently lines 88-94):

```tsx
      <button
        type="submit"
        disabled={submitting}
        className="mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Login
      </button>
```

Replace the `className` value with:

```tsx
      <button
        type="submit"
        disabled={submitting}
        className="mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
      >
        Login
      </button>
```

Do not change the `type`, `disabled`, or `Login` text — only the `className` string.

- [ ] **Step 2: Update the subtitle className in the login page**

In `app/login/page.tsx`, find (currently line 25):

```tsx
          <p className="mb-6 text-center text-xs text-slate-400">
```

Replace with:

```tsx
          <p className="mb-6 text-center text-[13px] text-slate-500">
```

The text content on the next line (`Sign in with your company or personal email`) is unchanged.

- [ ] **Step 3: Add the card entrance animation to globals.css**

In `app/globals.css`, append this block after the existing content (after line 19, the closing `}` of the `body` rule):

```css

@keyframes login-card-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-card-in {
  animation: login-card-in 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .login-card-in {
    animation: none;
  }
}
```

- [ ] **Step 4: Apply the animation class to the login card container**

In `app/login/page.tsx`, find the card container (currently line 10):

```tsx
      <div className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
```

Replace with:

```tsx
      <div className="login-card-in relative z-10 w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
```

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `npx vitest run`
Expected: `68 passed (68)` — same count as the last full-branch verification. No new tests are added (no logic changed), so the count must not increase or decrease.

- [ ] **Step 6: Grep-verify no unintended text or logic drift**

Run:
```bash
git diff --stat app/login/LoginForm.tsx app/login/page.tsx app/globals.css
```
Expected: only the three files above are touched, and `git diff` (not just `--stat`) shows only `className` attribute values changed in the `.tsx` files, plus a pure CSS addition in `globals.css`. No lines with English copy/text nodes should appear in the diff.

- [ ] **Step 7: Commit**

```bash
git add app/login/LoginForm.tsx app/login/page.tsx app/globals.css
git commit -m "Polish login page: button hover effect, subtitle contrast, card entrance animation"
```

**Manual verification (not part of the automated task, do after commit):**
- Load `/login` in the browser: card should fade in + rise on load.
- Hover the Login button: background darkens, button rises 2px, green shadow appears.
- Click/hold the button: settles back down, background darkens further, shadow tightens.
- Tab to the button with keyboard: 3px green focus ring visible, no default outline.
- Submit the form (trigger `disabled`): confirm hover/press effects do not fire while disabled.
- DevTools → emulate `prefers-reduced-motion: reduce`: confirm no card animation and no button lift/shadow-only color change on hover.

---
