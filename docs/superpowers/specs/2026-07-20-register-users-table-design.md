# Register User Page — Users Table + Modal Wizard

**Date:** 2026-07-20
**Branch:** `green-rebrand`
**Status:** Approved by user (mockup Option A in visual companion, session `750-1784509596`)

## Goal

Turn `/register` from a wizard-only page into a user-management view: the default
view is a table of all registered users, with a "+ Register User" button in the
upper right that opens the existing 3-step registration wizard in a modal.

## Current state

- `app/(authenticated)/register/page.tsx` is a server component that verifies the
  session cookie, gates on `canProvisionUsers`, and renders `RegistrationWizard`
  inside a centered 520px green-gradient card over the MFC background overlay.
- `RegistrationWizard.tsx` is a client component: 3 steps (role → details →
  review), posts to `/api/register`, then shows a success screen with a
  "REGISTER ANOTHER USER" reset button. On success it also calls
  `router.push("/register?success=1")` — a leftover with no consumer.

## Design

### 1. Data flow — server-side, no new API route

`page.tsx` keeps its session/permission gate and additionally queries Prisma
directly:

```ts
prisma.user.findMany({
  orderBy: { createdAt: "desc" },
  select: {
    id: true, firstName: true, lastName: true, role: true, createdAt: true,
    department: { select: { name: true } },
    businessUnit: { select: { name: true } },
    location: { select: { name: true } },
  },
})
```

Rows are mapped server-side to a flat serializable shape, with `createdAt`
pre-formatted as `"Jul 18, 2026"` (`en-US`, `{ month: "short", day: "numeric",
year: "numeric" }`) **on the server** so there is no timezone/hydration
mismatch. Email and any other fields are deliberately not passed to the client.

```ts
type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;            // enum value; label/pill styling resolved in the client component
  department: string;
  businessUnit: string;
  location: string;
  createdAt: string;     // pre-formatted display string
};
```

### 2. Components

**`page.tsx` (modified):** after the gate, fetches + maps rows and renders the
page shell: the existing full-bleed `bg-[#eef1ee]` container with the
`mfc-logo.png` overlay (unchanged from §3d treatment), containing
`<UsersView users={rows} />` at `relative z-10`, full width (no more centered
520px card at page level).

**`UsersView.tsx` (new, client, same directory):** owns all interactivity.

- Header row: left side — "Registered Users" heading (`text-slate-800`,
  semibold) with a small "N user(s)" count below (`text-slate-500`); right side —
  the "+ Register User" button: `rounded-full bg-[#2C7001] text-white`, with the
  branch's standard lift-hover treatment (darken + `-translate-y-0.5` + green
  shadow, `focus-visible` ring, `motion-reduce` neutralizers, matching the login
  button classes).
- Table card: white, `rounded-xl shadow`, `overflow-x-auto`. Columns, in order:
  **First Name, Last Name, Role, Department, Business Unit, Location, Created**.
  Header row: `bg-[#f8faf7]`, green bottom border (`border-b-2` in `#2C7001`),
  dark-green header text. Body rows: zebra striping (odd rows white, even rows
  `#fbfdf9`), `border-b border-slate-100`.
- Role column renders a colored pill per role (label from the existing
  `ROLE_LABELS` mapping, extracted so both wizard and table share it):

  | Role | Pill classes |
  |---|---|
  | `CREATOR` | `bg-sky-100 text-sky-800` |
  | `FIRST_APPROVER` | `bg-amber-100 text-amber-800` |
  | `SECOND_APPROVER` | `bg-green-100 text-green-800` |
  | `THIRD_APPROVER` | `bg-indigo-100 text-indigo-800` |
  | `GUARD_PERSONNEL` | `bg-purple-100 text-purple-800` |

- Empty state: when `users` is empty, the table body shows a single full-width
  row: "No users registered yet." (`text-slate-500`, centered).
- Modal state: `const [open, setOpen] = useState(false)`. When open, renders a
  fixed overlay (`fixed inset-0 z-50 bg-slate-900/35`, content scrollable via
  `overflow-y-auto`, top-aligned with padding) containing the wizard card: same
  `max-w-[520px]` white card with the green-gradient "REGISTER USER" header
  (markup moves here from `page.tsx`), plus an ✕ close button in the header
  (`aria-label="Close"`). The overlay div has `role="dialog"` and
  `aria-modal="true"` with `aria-labelledby` pointing at the header.
- Close behavior: **only the ✕ closes the modal.** Backdrop clicks and Escape do
  nothing — protects a half-completed wizard from accidental dismissal. Closing
  resets nothing inside the wizard by unmounting it (state naturally resets on
  next open, matching a fresh wizard each time).

**`RegistrationWizard.tsx` (one behavior change):** on successful registration,
replace `router.push("/register?success=1")` with `router.refresh()`, so the
server component re-fetches and the table behind the modal shows the new user.
Everything else (steps, validation gating, success screen, "REGISTER ANOTHER
USER") is unchanged.

**`ROLE_LABELS` extraction:** move `ROLES` / `ROLE_LABELS` from
`RegistrationWizard.tsx` into a new `lib/roles.ts` and import from both
the wizard and `UsersView`, so table pills and wizard dropdown can never drift.

### 3. Access control

Unchanged: the page redirects to `/dashboard` unless `canProvisionUsers(session)`.
The user list is only ever fetched inside that gate, and only display fields are
sent to the client (no email, no password hash, no ids beyond the row key).

### 4. Testing

- **`UsersView.test.tsx` (new):**
  - renders all 7 column headers;
  - renders row data (names, role label, department/BU/location, date string);
  - shows the empty state when `users={[]}`;
  - modal not present initially; clicking "+ Register User" opens it (dialog
    role + wizard step 1 visible); clicking ✕ closes it.
- **`RegistrationWizard.test.tsx` (updated):** the success path asserts
  `router.refresh()` is called (replacing any existing assertion on
  `router.push("/register?success=1")`).
- Full suite expectation: all tests pass except the known `prisma/seed.test.ts`
  baseline failure (81/82-era baseline; count grows with the new file).

## Out of scope

- Search/filter/sort/pagination on the table (revisit if the user list grows).
- Editing or deactivating users from the table.
- Showing email or any credential-adjacent field.
- Backdrop-click / Escape dismissal of the modal.
