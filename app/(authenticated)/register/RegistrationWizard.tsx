"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { registrationSchema, editUserSchema } from "@/lib/validation/registration";
import { ROLES, ROLE_LABELS, type RoleValue } from "@/lib/roles";
import { fieldLabel, fieldUnderline, buttonPrimary, buttonSecondary } from "@/lib/deepForest";

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

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
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
          {n < 3 && (
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
          <p className="mb-6 text-xs leading-relaxed text-slate-600">
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
        <p className="mb-6 text-xs leading-relaxed text-slate-600">
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
        <StepIndicator step={1} />
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
    return (
      <div>
        <StepIndicator step={2} />
        <div className="mb-3.5 text-sm font-bold text-[#7be36f]">
          Personal &amp; account details
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
            onClick={() => setStep(1)}
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
            onClick={() => setStep(3)}
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
      <StepIndicator step={3} />
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
          onClick={() => setStep(2)}
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
