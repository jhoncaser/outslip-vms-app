# Registration Wizard — Split Into More, Shorter Steps — Design

**Date:** 2026-08-08
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming` with the visual companion, session `1106-1786158285`)

## Goal

The Register/Edit User wizard's step 2 ("Personal & account details") has 8 fields when editing and 10 when creating (First/Middle/Last Name, Job Title, Department, Business Unit, Location, Email, and — create-only — Password/Confirm Password). On typical viewport heights the modal's content is taller than the visible area; because the modal is centered with a flex `items-center` layout, the overflow pushes the modal's own green header (title + step indicator + close button) above the visible scroll area, which visually collides with the navbar above it. The user reported this as "the navbar overlaps the registration form" and asked for the form to be made shorter via pagination.

Fix: redistribute the existing fields across more, shorter steps. No fields are added or removed, and no separate CSS fix for the overlap is planned — shrinking each step's content is expected to remove the vertical overflow that caused it; this will be confirmed live once built (see Testing).

## Scope

- Applies to `app/(authenticated)/register/RegistrationWizard.tsx`, used for both the create flow (`UsersView`'s "+ Register User") and the edit flow (`UsersView`'s per-row "Edit").
- Field regrouping and step-indicator changes only. No new fields, no validation-rule changes (same Zod schemas), no changes to `POST /api/register` or `PATCH /api/users/[id]`.

## Design

### 1. Step flow

Five steps, up from three (user-approved "Option B" from the visual companion mockup):

| # | Step name | Fields |
|---|---|---|
| 1 | Role | Role (unchanged from today) |
| 2 | Personal Info | First Name, Middle Name, Last Name, Job Title |
| 3 | Work Assignment | Department, Business Unit, Location |
| 4 | Account | Email, and — create-only — Password, Confirm Password |
| 5 | Review | Unchanged — same summary + Submit |

Step 2 of today's wizard is retired; its fields move into the new steps 2-4 above with no changes to labels, input types, or `fieldUnderline`/`fieldLabel` styling. Today's step 3 (Review) becomes step 5, content unchanged.

### 2. `StepIndicator` generalization

Currently hardcoded to `[1, 2, 3]` with a `n < 3` check for the connector line between circles. Generalize to accept a `total` prop:

```tsx
function StepIndicator({ step, total }: { step: number; total: number }) {
  // [1..total].map(...), connector rendered when n < total
}
```

Called as `<StepIndicator step={n} total={5} />` from every step. No other visual change to the circles/connectors.

### 3. Per-step "Next" validation

Today, the single step-2-to-3 transition gates on the full `registrationSchema`/`editUserSchema` (catches every required field, email format, and password length/match all at once, right before Review). With four data-entry steps instead of one, validating everything only at the very end would mean a user could click through three steps with blank fields and only find out at step 4. Instead:

- **Personal Info → Next**: enabled only when First Name, Last Name, and Job Title are non-empty (Middle Name stays optional, unchanged).
- **Work Assignment → Next**: enabled only when Department, Business Unit, and Location are all selected.
- **Account → Next**: enabled only when the full `registrationSchema` (create) / `editUserSchema` (edit) passes `safeParse(form)` — this is the existing check, just moved from the old step 2 to the new step 4. It still validates every field collected across steps 1-4 (email format, password length/match included), not just the Account step's own fields — no change in what gets caught, only when.
- Role → Next and Review's Back/Submit behavior are unchanged.

This is plain boolean checks on `form` fields for steps 2-3 (matching the field-level style already used elsewhere in this app, e.g. `lib/transactionFieldSets.ts`'s required-field helpers), not new partial-Zod-schema slicing — `registrationSchema` is a `.refine()`-wrapped schema so partial `.pick()` isn't directly available on it, and simple non-empty checks are all steps 2-3 need.

### 4. Component structure

`RegistrationWizard.tsx` stays a single component with `step` state now ranging 1-5 (`useState(1)`, unchanged pattern) and an `if (step === N)` chain per step, matching the existing style — no extraction into separate step components, consistent with this being a single ~500-line file already organized this way today.

### 5. Edit mode

Unchanged behavior, now on the new Account step (4) instead of the old step 2: Password/Confirm Password fields are omitted entirely (`{!isEditing && (...)}`), same as today.

### 6. Testing

- `RegistrationWizard.test.tsx` (or wherever current step-2 field tests live): update to step through Personal Info → Work Assignment → Account individually; verify each step's Next-button gating (disabled/enabled per section 3); verify Review still shows the full correct summary at step 5.
- `UsersView.test.tsx`: any test that drives the wizard end-to-end (create or edit flow) needs its click-through sequence extended for the extra steps.
- Live verification: open the Register User modal against the dev server and confirm the green header no longer visually collides with the navbar on a normal viewport height, for both create and edit.

## Out of scope

- Any change to the Review step's content or the final submit/API behavior.
- Any change to validation rules themselves (still the same `registrationSchema`/`editUserSchema`).
- A dedicated CSS/layout fix for the modal-centering-overflow behavior itself — if shortening the steps doesn't fully resolve the overlap on some viewport size, that's a follow-up, not part of this round.
