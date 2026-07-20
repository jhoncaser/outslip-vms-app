# Edit Button Style — Design

**Date:** 2026-07-20
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via visual companion, session `750-1784509596`, screen `edit-button-style.html`, 4 options: icon-only circular, icon+label pill, solid mini-fill, text-with-hover-chip)

## Goal

Replace the users table's plain underlined-text "Edit" trigger (`app/(authenticated)/register/UsersView.tsx`) with something that reads as an actual button at rest, not just on hover.

## Chosen design: option B — icon + label pill, outlined

A small bordered pill: pencil icon + "Edit" text, green on white, fills a faint green tint and the border goes full green on hover. Picked over icon-only (ambiguous for an icon-illiterate admin user, and this is the only per-row action) and over keeping plain text with just a hover background (still reads as a link, not a button, and undercuts the ask). Matches the table's existing role pills (same rounded-pill shape) and the pencil icon follows the app's established inline Feather-style SVG convention (`components/dashboard/Sidebar.tsx`).

## Implementation

`app/(authenticated)/register/UsersView.tsx` only — classNames plus one inline icon, no markup restructuring, no new props/state, no dependency changes.

**Button** — current:

```tsx
<button
  type="button"
  onClick={() => setModal({ mode: "edit", userId: user.id })}
  className="text-xs font-semibold text-[#2C7001] hover:underline"
>
  Edit
</button>
```

becomes:

```tsx
<button
  type="button"
  onClick={() => setModal({ mode: "edit", userId: user.id })}
  className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe3c4] bg-white px-2.5 py-1 text-xs font-semibold text-[#2C7001] transition-colors duration-150 hover:border-[#2C7001] hover:bg-[#f2f8ee] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none"
>
  <EditIcon />
  Edit
</button>
```

New local icon component (same file, same convention as `Sidebar.tsx`'s `HomeIcon`/`UserIcon`):

```tsx
function EditIcon() {
  return (
    <svg
      aria-hidden
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
```

The visible text "Edit" stays in the DOM (icon is `aria-hidden`), so the button's accessible name is unchanged — `UsersView.test.tsx`'s existing `getByRole("button", { name: /^edit$/i })` queries keep passing unmodified.

## Accessibility

- Icon is decorative (`aria-hidden`); "Edit" text remains the accessible name.
- `focus-visible` ring added (reused from the login/change-password button convention, `focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35`) since this now looks and behaves like a standalone button rather than an inline text link.
- `motion-reduce:transition-none` disables the hover color transition under reduced-motion (only a color change, no movement, so this is a minor courtesy, not a requirement).

## Testing

No new tests. Purely decorative/classNames change with an unchanged accessible name — existing `UsersView.test.tsx` coverage (Edit button presence per row, click opens the edit modal) still applies unmodified.

## Explicitly declined

- Option A (icon-only circular button) — more compact but ambiguous without a label.
- Option C (solid mini-fill button) — reasonable but reads slightly heavier than needed for a single per-row action; outlined pill was preferred.
- Option D (text kept, hover-only chip) — doesn't satisfy the ask (still just text at rest).
