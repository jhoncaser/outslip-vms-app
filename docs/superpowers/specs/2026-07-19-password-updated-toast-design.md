# "Password Updated!" Toast — Design

**Page:** `app/change-password/ChangePasswordForm.tsx`

## Purpose

Give the user explicit confirmation that their password update succeeded, before they're redirected to the dashboard. Chosen over a login-success toast (rejected — the dashboard redirect is sufficient confirmation there) because a password change is a higher-stakes action where "did that actually save?" is a reasonable moment of doubt.

## Behavior

On successful password update:
1. Show the toast immediately.
2. Keep the submit button disabled (it already disables during submission; this just holds that state through the delay instead of re-enabling right away, preventing a double-submit during the pause).
3. After 1.5 seconds, redirect to `/dashboard` (same destination as today, just delayed).

Error path is unchanged: no toast, existing inline `role="alert"` error message stays as-is.

## Visual design (selected via visual-companion mockup, option A)

- Fixed top-right of the viewport.
- White background, `#2C7001` left accent border, small green (`#2C7001`) circular checkmark badge, text "Password Updated!".
- Slides in from the top-right.
- Respects `prefers-reduced-motion: reduce` — fades in without translation instead of sliding, consistent with the existing `.login-card-in` treatment in `app/globals.css`.

## Accessibility

`role="status"` with `aria-live="polite"` so screen readers announce it without stealing focus from the page.

## Implementation approach

Self-contained in `ChangePasswordForm.tsx` — local `showToast` state, inline JSX, and a small CSS animation added to `app/globals.css` (mirroring the `login-card-in` keyframe pattern). No new reusable Toast component or dependency — this is a single-use case; a generic toast system is not needed yet (YAGNI).

## Test impact

`ChangePasswordForm.test.tsx`'s existing "redirects to /dashboard after a successful change" test asserts `router.push` via `waitFor` (default 1000ms timeout, real timers). Since the redirect now fires after a 1.5s delay, this test needs updating — either raise the `waitFor` timeout past 1.5s, or switch to fake timers (`vi.useFakeTimers()` + `vi.advanceTimersByTime`). Also add a new assertion/test that the toast text ("Password Updated!") appears in the DOM immediately after a successful submit, before the redirect fires.

## Out of scope

- No toast on login (decided separately, see handoff).
- No toast on the error path.
- No generic/reusable toast component — scoped to this one usage.
