# Edit Existing User — Reusing the Registration Wizard

**Date:** 2026-07-20
**Branch:** `green-rebrand`
**Status:** Approved by user (session `750-1784509596`, continued)

## Goal

Let authorized users edit an already-registered user's details (Role, First/Middle/Last
Name, Job Title, Department, Business Unit, Location, Email) from the `/register` users
table, without building a second form — by reusing `RegistrationWizard` in an "edit"
mode. Password is never touched by this flow.

## Current state

- `/register` (`app/(authenticated)/register/page.tsx`) gates on `canProvisionUsers`
  (department `"Admin"` + role in `FIRST_APPROVER`/`SECOND_APPROVER`/`THIRD_APPROVER`,
  `lib/auth/permissions.ts:18`), fetches all users, and renders `<UsersView users={rows} />`.
- `UsersView` (`app/(authenticated)/register/UsersView.tsx`) renders the table and owns
  the "+ Register User" modal (`open` boolean state) wrapping `<RegistrationWizard />`.
- `RegistrationWizard` (`app/(authenticated)/register/RegistrationWizard.tsx`) is a
  3-step client wizard (role → personal/account details → review) that always creates a
  new user via `POST /api/register`, validated by `registrationSchema`
  (`lib/validation/registration.ts`), which requires `password`/`confirmPassword`.
- `UserRow` (the table's data shape) deliberately excludes email and reference-data IDs —
  only display names (`department`, `businessUnit`, `location` as strings) are sent to
  the client. This stays unchanged; see "Access control" below for how edit mode gets
  the fuller record without widening the table payload.

## Design

### 1. Validation — `lib/validation/registration.ts`

Add a second schema, `editUserSchema`, identical to `registrationSchema` minus the
password fields and its cross-field `.refine`:

```ts
export const editUserSchema = z.object({
  role: z.enum([
    "CREATOR",
    "FIRST_APPROVER",
    "SECOND_APPROVER",
    "THIRD_APPROVER",
    "GUARD_PERSONNEL",
  ]),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  jobTitle: z.string().min(1),
  departmentId: z.string().min(1),
  businessUnitId: z.string().min(1),
  locationId: z.string().min(1),
  email: z.string().email(),
});
```

Used both by the wizard's client-side "Next" gating in edit mode and by the new PATCH
route below.

### 2. New API route — `app/api/users/[id]/route.ts`

Both handlers repeat the exact auth pattern already used in `app/api/register/route.ts`:
session cookie → `verifySessionToken` → 401 if absent → `canProvisionUsers(session)` →
403 if false.

**`GET`** — returns one user's editable fields (fetched only when an authorized user
opens the Edit modal for that specific row — this is what keeps email and reference-data
IDs out of the bulk table load):

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ...auth checks...
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      firstName: true,
      middleName: true,
      lastName: true,
      jobTitle: true,
      email: true,
      departmentId: true,
      businessUnitId: true,
      locationId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}
```

**`PATCH`** — validates via `editUserSchema`, updates, 409 on email collision with a
*different* row (mirrors the existing `P2002` handling in `/api/register`; updating a
row to its own current email is not a collision, so no self-exclusion logic is needed):

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ...auth checks...
  const { id } = await params;
  const body = await request.json();
  const parsed = editUserSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".");
    return NextResponse.json(
      { error: field ? `${field}: ${issue.message}` : issue.message },
      { status: 400 }
    );
  }

  const data = parsed.data;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        jobTitle: data.jobTitle,
        email: data.email,
        role: data.role,
        departmentId: data.departmentId,
        businessUnitId: data.businessUnitId,
        locationId: data.locationId,
      },
    });
    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 409 }
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    throw err;
  }
}
```

### 3. `RegistrationWizard` — edit mode

New optional props:

```ts
type RegistrationWizardProps = {
  userId?: string;
  onDone?: () => void;
};
```

`userId` present ⇒ edit mode. Behavior changes, all conditional on that:

- **Load:** alongside the existing reference-data fetch, add a second effect that (when
  `userId` is set) calls `GET /api/users/${userId}` and populates `form` from the
  response (all fields except password/confirmPassword, which stay at `""` and unused).
  While this fetch is in flight, render a small "Loading user…" placeholder instead of
  Step 1, so the role dropdown and inputs never flash empty before filling in. If the
  fetch fails (network error or a non-OK response, e.g. the user was deleted after the
  table loaded), replace the placeholder with an inline error message — same
  `role="alert"` treatment already used for submit errors — and no further form
  rendering, since there is nothing valid to edit.
- **Step 2 fields:** the Password and Confirm Password `<label>`/`<PasswordInput>` pairs
  are omitted entirely when `userId` is set (not just skipped from validation — removed
  from the DOM).
- **Step headings/copy:** all three step titles ("Select your role", "Personal &
  account details", "Review & confirm") stay exactly as they are in both modes — only
  the outer modal header (§4) and the success screen (below) change wording for edit
  mode. No other copy changes.
- **Step 2 "Next" gating:** validate against `editUserSchema` instead of
  `registrationSchema` when in edit mode.
- **Submit:** in edit mode, `submit()` calls
  `fetch(\`/api/users/${userId}\`, { method: "PATCH", body: JSON.stringify(editableFields) })`
  instead of `POST /api/register` (the payload omits `password`/`confirmPassword`, which
  don't exist on the form in this mode). Same error handling as today (`body.error`
  surfaced via the existing `error` state).
- **Success screen:** in edit mode, copy changes from "Registration complete" / "…has
  been registered with a temporary password…" to "Changes saved" / "{Name}'s details
  have been updated.", and the button changes from "REGISTER ANOTHER USER" (which resets
  the form to blank) to "DONE", which calls `onDone?.()` instead of resetting state.
- **`router.refresh()`** on success is unchanged — fires in both modes so the table
  behind the modal re-fetches either way.

### 4. `UsersView` — Edit trigger and modal mode

- Add an **Actions** column, rightmost, to the `COLUMNS` array and each row, containing a
  small "Edit" button.
- Replace the single `open` boolean with a small discriminated state:

  ```ts
  type ModalState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; userId: string };
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  ```

  "+ Register User" sets `{ mode: "create" }`; each row's "Edit" button sets
  `{ mode: "edit", userId: user.id }`.
- The modal header text becomes conditional: `"REGISTER USER"` for create,
  `"EDIT USER"` for edit.
- `<RegistrationWizard>` receives `userId={modal.mode === "edit" ? modal.userId : undefined}`
  and `onDone={() => setModal({ mode: "closed" })}`.
- Close behavior is unchanged for both modes: only the ✕ closes it; backdrop/Escape do
  nothing (still protects a half-finished edit, same reasoning as the create flow).

### 5. Access control

No new permission function: `canProvisionUsers` (department `"Admin"` +
`FIRST_APPROVER`/`SECOND_APPROVER`/`THIRD_APPROVER`) is exactly the rule requested for
edit access, and it's already what gates the entire `/register` page plus the existing
`POST /api/register` route. Both new handlers (`GET`/`PATCH` on `/api/users/[id]`) apply
the identical check directly (matching the existing duplication style in
`app/api/register/route.ts` rather than introducing a shared middleware — consistent
with the current codebase, not a new pattern).

### 6. Testing

- **`lib/validation/registration.test.ts`:** add tests for `editUserSchema` (accepts a
  valid payload without password fields; rejects missing `email`/`jobTitle`/etc.).
- **`app/api/users/[id]/route.test.ts` (new):** 401 with no session; 403 for a
  non-provisioner session; `GET` 404 for an unknown id; `GET` 200 returning the expected
  fields for a known id; `PATCH` 200 updating fields (verify via a follow-up `findUnique`);
  `PATCH` 409 when the new email collides with a *different* existing user; `PATCH` 200
  when the email is left unchanged (no false 409 against itself); `PATCH` 404 for an
  unknown id.
- **`RegistrationWizard.test.tsx`:** new tests for edit mode — given a `userId` prop and
  a mocked `GET /api/users/:id` response, the wizard shows the loading placeholder then
  prefilled fields; Password/Confirm Password are not present; submitting calls
  `PATCH /api/users/:id` (not `POST /api/register`); the success screen shows "Changes
  saved" and a "DONE" button that calls `onDone`.
- **`UsersView.test.tsx`:** Actions column renders an Edit button per row; clicking it
  opens the modal with header "EDIT USER" and triggers the `GET` fetch for that row's id
  (extend the existing `fetch` mock); modal header reads "REGISTER USER" for the create
  path (regression check).

## Out of scope

- Deleting/deactivating users.
- Bulk edit.
- Changing a user's password from this flow (explicitly deferred to a future
  self-service "change my password" flow, per user decision this session).
- Any new shared permission abstraction — the existing per-route `canProvisionUsers`
  check is reused as-is.
