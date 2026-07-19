# Login Page Polish — Design Spec

**Date:** 2026-07-19
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via visual companion; selections: button effect A "Lift & shadow", text option A "keep SIGN IN + subtitle fix", card polish item 2 "entrance animation" only)

## Context

The green rebrand (spec `2026-07-19-green-rebrand-login-register-design.md`) is complete. During manual testing the user asked for interaction polish on the login page: hover/press effects for the Login button, a text-hierarchy check, and card-level refinement. Options were reviewed live in the brainstorming visual companion; this spec records the chosen subset.

## Scope

**Files changed:**

- `app/login/LoginForm.tsx` — button className only
- `app/login/page.tsx` — subtitle className, card animation class (classNames only)
- `app/globals.css` — one keyframe + one animation class

**Explicitly unchanged:** all colors and the green palette, the gradient header, the faded MFC logo background, layout/structure, all text content, all form logic, all other pages. The change-password page is deliberately excluded — the user will test login first and decide later whether to propagate.

## Changes

### 1. Login button — "Lift & shadow" hover/press effect

`app/login/LoginForm.tsx`, submit button. Current className:

```
mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white disabled:opacity-60
```

New className:

```
mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white
transition-all duration-150 ease-out
hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)]
active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)]
focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35
motion-reduce:transition-none motion-reduce:hover:translate-y-0
disabled:pointer-events-none disabled:opacity-60
```

(one line in source; wrapped here for readability)

Behavior:

- Hover: background deepens `#2C7001` → `#256000`, button rises 2px, soft green shadow appears; 150ms ease-out transition.
- Press (`:active`): settles back to baseline, background deepens to `#1d4d00`, shadow tightens.
- Keyboard focus (`:focus-visible`): 3px green ring at 35% opacity, default outline removed.
- Reduced motion: no transition, no lift; color/shadow changes still apply.
- Disabled (while submitting): existing `disabled:opacity-60` retained; `disabled:pointer-events-none` added so hover/press effects cannot fire on a disabled button.

### 2. Subtitle readability

`app/login/page.tsx`, the paragraph "Sign in with your company or personal email". Current className:

```
mb-6 text-center text-xs text-slate-400
```

New className:

```
mb-6 text-center text-[13px] text-slate-500
```

Wording unchanged. "SIGN IN" remains the page's only `<h1>`, styling untouched; no element changes heading level.

### 3. Card entrance animation

`app/globals.css` — append:

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

`app/login/page.tsx` — add `login-card-in` to the card container div (currently `relative z-10 w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl`).

Behavior: on page load the card fades in while rising 16px over 400ms with an ease-out-expo-style curve; runs once; fully disabled under `prefers-reduced-motion: reduce`. Pure CSS — no JS, no layout shift (transform/opacity only).

A plain CSS class is used rather than a Tailwind `@theme` animation token because it is a single-use, page-specific animation; registering a theme-level utility adds indirection with no reuse benefit.

## Not included (reviewed and declined)

- Card shadow rework + hairline border
- Input focus-transition smoothing
- "Forgot Password?" hover state
- Mixed-case heading; brand eyebrow above heading

## Testing & verification

1. `npx vitest run` — full suite must stay green (68/68). No logic is touched, so no new tests are required; existing login-page tests must not need text changes (wording is unchanged).
2. Manual: user tests on the dev server — hover, press, keyboard-tab focus ring, entrance animation on refresh, disabled state during submit.
3. Reduced-motion spot check via DevTools emulation (`prefers-reduced-motion: reduce`): no card animation, no button lift.
