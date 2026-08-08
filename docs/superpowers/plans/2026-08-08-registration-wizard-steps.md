# Registration Wizard 5-Step Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Register/Edit User wizard from 3 steps to 5 (Role → Personal Info → Work Assignment → Account → Review) so no single step overflows the modal on a typical viewport, per `docs/superpowers/specs/2026-08-08-registration-wizard-steps-design.md`.

**Architecture:** Single-file change to `app/(authenticated)/register/RegistrationWizard.tsx` — same `useState(1)` step-counter pattern already used, just three data-entry steps instead of one, each gated by its own "Next" validation before advancing.

**Tech Stack:** React (client component), Zod (`registrationSchema`/`editUserSchema`, unchanged), Vitest + Testing Library.

## Global Constraints

- No fields are added, removed, or renamed — same `FormState` shape, same `id`/`htmlFor` pairs, same Zod schemas.
- No styling/token changes — reuse `fieldLabel`, `fieldUnderline`, `buttonPrimary`, `buttonSecondary` exactly as today.
- Steps 2 ("Personal Info") and 3 ("Work Assignment") gate their own "Next" button with plain non-empty checks on `form` fields — not a `.pick()` of the Zod schema (both schemas are `.refine()`/plain objects with a cross-field check that doesn't slice cleanly, and simple required-field checks are all these two steps need).
- Step 4 ("Account") keeps today's exact gate: `(isEditing ? editUserSchema : registrationSchema).safeParse(form).success` — this still validates every field collected across steps 1-4, unchanged from today's behavior, just moved later.
- `npm run dev` is already running for live verification — do not start a second one (see project's known-gotcha notes); if a schema/migration step were needed here it would require a restart, but this plan touches no schema, so no restart is expected.

---

### Task 1: Split the wizard into 5 steps with per-step validation

**Files:**
- Modify: `app/(authenticated)/register/RegistrationWizard.tsx` (whole file — `StepIndicator` plus the `step === 2`/`step === 3`/fallback branches)
- Test: `app/(authenticated)/register/RegistrationWizard.test.tsx` (whole file)

**Interfaces:**
- Consumes: existing `registrationSchema`/`editUserSchema` from `@/lib/validation/registration` (unchanged), `ROLES`/`ROLE_LABELS`/`RoleValue` from `@/lib/roles` (unchanged), `fieldLabel`/`fieldUnderline`/`buttonPrimary`/`buttonSecondary` from `@/lib/deepForest` (unchanged), `PasswordInput` from `@/components/PasswordInput` (unchanged props: `id`, `value`, `onChange`, `wrapperClassName`, `inputClassName`).
- Produces: `RegistrationWizard({ userId?, onDone? })` — same external props and behavior (create vs. edit mode, same success screens, same `POST /api/register` / `PATCH /api/users/[id]` bodies) as today; only the internal step count and per-step gating changes. No other file imports from this one besides `UsersView.tsx`, which only renders `<RegistrationWizard userId={...} onDone={...} />` and doesn't reach into its internals — no changes needed there.

- [ ] **Step 1: Write the failing test file**

Replace the full contents of `app/(authenticated)/register/RegistrationWizard.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrationWizard } from "./RegistrationWizard";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const referenceData = {
  departments: [{ id: "dept_1", name: "ICT" }],
  businessUnits: [{ id: "bu_1", name: "Cawit" }],
  locations: [{ id: "loc_1", name: "Zamboanga" }],
};

function goToPersonalInfo() {
  fireEvent.change(screen.getByLabelText(/role/i), {
    target: { value: "CREATOR" },
  });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

function fillPersonalInfo() {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Juan" },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: "Dela Cruz" },
  });
  fireEvent.change(screen.getByLabelText(/job title/i), {
    target: { value: "IT Officer" },
  });
}

function fillWorkAssignment() {
  fireEvent.change(screen.getByLabelText(/^department$/i), {
    target: { value: "dept_1" },
  });
  fireEvent.change(screen.getByLabelText(/business unit/i), {
    target: { value: "bu_1" },
  });
  fireEvent.change(screen.getByLabelText(/^location$/i), {
    target: { value: "loc_1" },
  });
}

describe("RegistrationWizard", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/register") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "new_user_1" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("walks through all 5 steps and submits", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();

    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    fillWorkAssignment();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "juan.delacruz@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/review & confirm/i);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/register",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    expect(await screen.findByText(/registration complete/i)).toBeInTheDocument();
    expect(screen.getByText(/juan dela cruz has been registered/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /register another user/i })
    );
    await screen.findByText(/select a role/i);
  });

  it("keeps Personal Info's Next button disabled until name and job title are filled", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();

    await screen.findByLabelText(/first name/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Juan" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "IT Officer" },
    });
    expect(nextButton).not.toBeDisabled();
  });

  it("keeps Work Assignment's Next button disabled until department, business unit, and location are selected", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();
    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "dept_1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/business unit/i), {
      target: { value: "bu_1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "loc_1" },
    });
    expect(nextButton).not.toBeDisabled();
  });

  it("keeps Account's Next button disabled until email and password are valid", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();
    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText(/work assignment/i);
    fillWorkAssignment();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "juan.delacruz@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "short" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "supersecure1" },
    });
    expect(nextButton).not.toBeDisabled();
  });
});

describe("RegistrationWizard — edit mode", () => {
  const onDoneMock = vi.fn();
  const existingUser = {
    id: "user_1",
    role: "APPROVER",
    firstName: "Maria",
    middleName: "",
    lastName: "Santos",
    jobTitle: "HR Manager",
    email: "maria.santos@company.com",
    departmentId: "dept_1",
    businessUnitId: "bu_1",
    locationId: "loc_1",
  };

  beforeEach(() => {
    onDoneMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/users/user_1" && !init) {
          return Promise.resolve({
            ok: true,
            json: async () => existingUser,
          });
        }
        if (url === "/api/users/user_1" && init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "user_1" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("loads the existing user, hides password fields, and submits a PATCH", async () => {
    render(<RegistrationWizard userId="user_1" onDone={onDoneMock} />);

    expect(screen.getByText(/loading user/i)).toBeInTheDocument();

    await screen.findByLabelText(/role/i);
    expect(screen.getByLabelText(/role/i)).toHaveValue("APPROVER");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByDisplayValue("Maria");
    expect(screen.getByDisplayValue("Santos")).toBeInTheDocument();
    expect(screen.getByDisplayValue("HR Manager")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Senior HR Manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/review & confirm/i);
    expect(screen.getByText("Senior HR Manager")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/users/user_1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    const patchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => url === "/api/users/user_1" && init?.method === "PATCH"
    );
    const patchBody = JSON.parse(patchCall![1].body as string);
    expect(patchBody).toEqual({
      role: "APPROVER",
      firstName: "Maria",
      middleName: "",
      lastName: "Santos",
      jobTitle: "Senior HR Manager",
      departmentId: "dept_1",
      businessUnitId: "bu_1",
      locationId: "loc_1",
      email: "maria.santos@company.com",
    });
    expect(patchBody.password).toBeUndefined();
    expect(patchBody.confirmPassword).toBeUndefined();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    expect(await screen.findByText(/changes saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onDoneMock).toHaveBeenCalled();
  });

  it("shows an error if the user fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/users/user_1") {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Not found" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );

    render(<RegistrationWizard userId="user_1" onDone={onDoneMock} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/\(authenticated\)/register/RegistrationWizard.test.tsx`
Expected: FAIL — the current component only has 3 steps, so text like "Personal Info" / "Work Assignment" / "Account" (singular headings) won't be found, and the old single "step 2" screen mixes all the fields together.

- [ ] **Step 3: Replace `RegistrationWizard.tsx` with the 5-step version**

Replace the full contents of `app/(authenticated)/register/RegistrationWizard.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { registrationSchema, editUserSchema } from "@/lib/validation/registration";
import { ROLES, ROLE_LABELS, type RoleValue } from "@/lib/roles";
import { fieldLabel, fieldUnderline, buttonPrimary, buttonSecondary } from "@/lib/deepForest";

const TOTAL_STEPS = 5;

type ReferenceItem = { id: string; name: string };
type ReferenceData = {
  departments: ReferenceItem[];
  businessUnits: ReferenceItem[];
  locations: ReferenceItem[];
};

type FormState = {
  role: RoleValue | "";
  firstName: string;
  middleName: string;
  lastName: string;
  jobTitle: string;
  departmentId: string;
  businessUnitId: string;
  locationId: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: FormState = {
  role: "",
  firstName: "",
  middleName: "",
  lastName: "",
  jobTitle: "",
  departmentId: "",
  businessUnitId: "",
  locationId: "",
  email: "",
  password: "",
  confirmPassword: "",
};

type RegistrationWizardProps = {
  userId?: string;
  onDone?: () => void;
};

function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {steps.map((n) => (
        <div key={n} className="flex flex-1 items-center gap-1.5 last:flex-none">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              n <= step
                ? "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white"
                : "bg-[#1c2519] text-[#6f8a68]"
            }`}
          >
            {n < step ? "✓" : n}
          </div>
          {n < total && (
            <div
              className={`h-0.5 flex-1 ${n < step ? "bg-[#3a9d0a]" : "bg-[#1c2519]"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function RegistrationWizard({ userId, onDone }: RegistrationWizardProps) {
  const isEditing = Boolean(userId);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingUser, setLoadingUser] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reference-data")
      .then((res) => res.json())
      .then(setReferenceData);
  }, []);

  useEffect(() => {
    if (!userId) return;

    fetch(`/api/users/${userId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load user");
        }
        return res.json();
      })
      .then((user) => {
        setForm((prev) => ({
          ...prev,
          role: user.role,
          firstName: user.firstName,
          middleName: user.middleName ?? "",
          lastName: user.lastName,
          jobTitle: user.jobTitle,
          departmentId: user.departmentId,
          businessUnitId: user.businessUnitId,
          locationId: user.locationId,
          email: user.email,
        }));
        setLoadingUser(false);
      })
      .catch(() => {
        setLoadError("Could not load user details. Please close and try again.");
        setLoadingUser(false);
      });
  }, [userId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function nameFor(list: ReferenceItem[] | undefined, id: string) {
    return list?.find((item) => item.id === id)?.name ?? "";
  }

  async function submit() {
    setError(null);
    setSubmitting(true);

    try {
      const response = isEditing
        ? await fetch(`/api/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: form.role,
              firstName: form.firstName,
              middleName: form.middleName,
              lastName: form.lastName,
              jobTitle: form.jobTitle,
              departmentId: form.departmentId,
              businessUnitId: form.businessUnitId,
              locationId: form.locationId,
              email: form.email,
            }),
          })
        : await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isEditing && loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {loadError}
      </p>
    );
  }

  if (isEditing && loadingUser) {
    return (
      <div className="py-10 text-center text-sm text-[#9db894]">
        Loading user…
      </div>
    );
  }

  if (success) {
    if (isEditing) {
      return (
        <div>
          <div className="mb-3 text-sm font-bold text-[#7be36f]">
            Changes saved
          </div>
          <p className="mb-6 text-xs leading-relaxed text-[#cfe9c7]">
            Details for{" "}
            {[form.firstName, form.lastName].filter(Boolean).join(" ")} have
            been updated.
          </p>
          <button
            type="button"
            onClick={() => onDone?.()}
            className={`${buttonPrimary} px-5`}
          >
            DONE
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-3 text-sm font-bold text-[#7be36f]">
          Registration complete
        </div>
        <p className="mb-6 text-xs leading-relaxed text-[#cfe9c7]">
          {[form.firstName, form.lastName].filter(Boolean).join(" ")} has
          been registered with a temporary password and will be asked to
          set a new one on first login.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(initialState);
            setStep(1);
            setSuccess(false);
          }}
          className={`${buttonPrimary} px-5`}
        >
          REGISTER ANOTHER USER
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div>
        <StepIndicator step={1} total={TOTAL_STEPS} />
        <div className="mb-3.5 text-sm font-bold text-[#7be36f]">
          Select your role
        </div>
        <label htmlFor="role" className={fieldLabel}>
          Role
        </label>
        <select
          id="role"
          aria-label="Role"
          value={form.role}
          onChange={(e) => update("role", e.target.value as FormState["role"])}
          className={`mb-2 block h-8 ${fieldUnderline}`}
        >
          <option value="">Select a role...</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <div className="mb-4 text-[10px] leading-relaxed text-[#6f8a68]">
          {ROLES.map((role) => ROLE_LABELS[role]).join("  ·  ")}
        </div>
        <button
          type="button"
          disabled={!form.role}
          onClick={() => setStep(2)}
          className={`ml-auto block ${buttonPrimary}`}
        >
          NEXT →
        </button>
      </div>
    );
  }

  if (step === 2) {
    const step2Valid =
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      form.jobTitle.trim().length > 0;

    return (
      <div>
        <StepIndicator step={2} total={TOTAL_STEPS} />
        <div className="mb-3.5 text-sm font-bold text-[#7be36f]">
          Personal Info
        </div>
        <label htmlFor="firstName" className={fieldLabel}>
          First Name
        </label>
        <input
          id="firstName"
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        />

        <label htmlFor="middleName" className={fieldLabel}>
          Middle Name
        </label>
        <input
          id="middleName"
          value={form.middleName}
          onChange={(e) => update("middleName", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        />

        <label htmlFor="lastName" className={fieldLabel}>
          Last Name
        </label>
        <input
          id="lastName"
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        />

        <label htmlFor="jobTitle" className={fieldLabel}>
          Job Title
        </label>
        <input
          id="jobTitle"
          value={form.jobTitle}
          onChange={(e) => update("jobTitle", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        />

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={buttonSecondary}
          >
            ← BACK
          </button>
          <button
            type="button"
            disabled={!step2Valid}
            onClick={() => setStep(3)}
            className={buttonPrimary}
          >
            NEXT →
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    const step3Valid =
      form.departmentId.length > 0 &&
      form.businessUnitId.length > 0 &&
      form.locationId.length > 0;

    return (
      <div>
        <StepIndicator step={3} total={TOTAL_STEPS} />
        <div className="mb-3.5 text-sm font-bold text-[#7be36f]">
          Work Assignment
        </div>
        <label htmlFor="department" className={fieldLabel}>
          Department
        </label>
        <select
          id="department"
          aria-label="Department"
          value={form.departmentId}
          onChange={(e) => update("departmentId", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        >
          <option value="">Select...</option>
          {referenceData?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label htmlFor="businessUnit" className={fieldLabel}>
          Business Unit
        </label>
        <select
          id="businessUnit"
          aria-label="Business Unit"
          value={form.businessUnitId}
          onChange={(e) => update("businessUnitId", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        >
          <option value="">Select...</option>
          {referenceData?.businessUnits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <label htmlFor="location" className={fieldLabel}>
          Location
        </label>
        <select
          id="location"
          aria-label="Location"
          value={form.locationId}
          onChange={(e) => update("locationId", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        >
          <option value="">Select...</option>
          {referenceData?.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(2)}
            className={buttonSecondary}
          >
            ← BACK
          </button>
          <button
            type="button"
            disabled={!step3Valid}
            onClick={() => setStep(4)}
            className={buttonPrimary}
          >
            NEXT →
          </button>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div>
        <StepIndicator step={4} total={TOTAL_STEPS} />
        <div className="mb-3.5 text-sm font-bold text-[#7be36f]">
          Account
        </div>
        <label htmlFor="email" className={fieldLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className={`mb-4 h-8 ${fieldUnderline}`}
        />

        {!isEditing && (
          <>
            <label htmlFor="password" className={fieldLabel}>
              Password
            </label>
            <PasswordInput
              id="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              wrapperClassName="mb-4"
              inputClassName={`h-8 ${fieldUnderline} pr-9`}
            />

            <label htmlFor="confirmPassword" className={fieldLabel}>
              Confirm Password
            </label>
            <PasswordInput
              id="confirmPassword"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              wrapperClassName="mb-5"
              inputClassName={`h-8 ${fieldUnderline} pr-9`}
            />
          </>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(3)}
            className={buttonSecondary}
          >
            ← BACK
          </button>
          <button
            type="button"
            disabled={
              !(isEditing ? editUserSchema : registrationSchema).safeParse(form)
                .success
            }
            onClick={() => setStep(5)}
            className={buttonPrimary}
          >
            NEXT →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={5} total={TOTAL_STEPS} />
      <div className="mb-3 text-sm font-bold text-[#7be36f]">
        Review &amp; confirm
      </div>
      <div className="mb-4 rounded border border-[#4ca71a]/25 bg-[#0f1611]/60 p-4 text-xs leading-loose text-[#cfe9c7]">
        <div className="flex justify-between">
          <span>Role</span>
          <span>{form.role ? ROLE_LABELS[form.role] : ""}</span>
        </div>
        <div className="flex justify-between">
          <span>Name</span>
          <span>
            {[form.firstName, form.middleName, form.lastName]
              .filter(Boolean)
              .join(" ")}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Job Title</span>
          <span>{form.jobTitle}</span>
        </div>
        <div className="flex justify-between">
          <span>Department</span>
          <span>{nameFor(referenceData?.departments, form.departmentId)}</span>
        </div>
        <div className="flex justify-between">
          <span>Business Unit</span>
          <span>
            {nameFor(referenceData?.businessUnits, form.businessUnitId)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Location</span>
          <span>{nameFor(referenceData?.locations, form.locationId)}</span>
        </div>
        <div className="flex justify-between">
          <span>Email</span>
          <span>{form.email}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(4)}
          className={buttonSecondary}
        >
          ← BACK
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className={buttonPrimary}
        >
          SUBMIT REGISTRATION
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/\(authenticated\)/register/RegistrationWizard.test.tsx`
Expected: PASS, all 6 tests (4 in the top `describe`, 2 in edit mode).

- [ ] **Step 5: Run the full suite to check for collateral breakage**

Run: `npx vitest run`
Expected: same baseline as before this change (2 known pre-existing `prisma/seed.test.ts` failures — seed-admin drift and reference-data drift, see the branch's handoff doc §5 — nothing else new). `UsersView.test.tsx` should be unaffected since it only opens the modal to step 1 and doesn't drive the wizard through further steps.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/register/RegistrationWizard.tsx" "app/(authenticated)/register/RegistrationWizard.test.tsx"
git commit -m "Split registration wizard into 5 shorter steps

Personal Info, Work Assignment, and Account each get their own step
instead of one 8-10 field step, so the modal no longer overflows a
typical viewport height. Each new step gates its own Next button;
final Account-step validation is unchanged (same schema, just moved)."
```

## Post-task verification (controller, not a subagent)

After Task 1 is reviewed and committed, live-verify against the running dev server (`http://localhost:3000`, already up):
1. Open Register User — confirm 5 dots in the step indicator, "Personal Info" is step 2.
2. Step through all 5 screens for a new user, confirm each Next button's disabled state matches the spec, submit successfully.
3. Open Edit on an existing user — confirm Password/Confirm Password are absent on the Account step, PATCH still succeeds.
4. Specifically check whether the green modal header still visually collides with the navbar now that each step is shorter (the spec's hypothesis is that it won't) — report back either way.
