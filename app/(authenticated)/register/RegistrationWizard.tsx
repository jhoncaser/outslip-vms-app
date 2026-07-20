"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { registrationSchema } from "@/lib/validation/registration";
import { ROLES, ROLE_LABELS, type RoleValue } from "@/lib/roles";

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

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex flex-1 items-center gap-1.5 last:flex-none">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              n <= step ? "bg-[#2C7001] text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {n < step ? "✓" : n}
          </div>
          {n < 3 && (
            <div
              className={`h-0.5 flex-1 ${n < step ? "bg-[#2C7001]" : "bg-slate-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function RegistrationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/reference-data")
      .then((res) => res.json())
      .then(setReferenceData);
  }, []);

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
      const response = await fetch("/api/register", {
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

  if (success) {
    return (
      <div>
        <div className="mb-3 text-sm font-bold text-[#2C7001]">
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
          className="rounded-full bg-[#2C7001] px-5 py-2.5 text-sm font-semibold text-white"
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
        <div className="mb-3.5 text-sm font-bold text-[#2C7001]">
          Select your role
        </div>
        <label htmlFor="role" className="text-xs text-slate-500">
          Role
        </label>
        <select
          id="role"
          aria-label="Role"
          value={form.role}
          onChange={(e) => update("role", e.target.value as FormState["role"])}
          className="mb-2 block h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        >
          <option value="">Select a role...</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <div className="mb-4 text-[10px] leading-relaxed text-slate-400">
          {ROLES.map((role) => ROLE_LABELS[role]).join("  ·  ")}
        </div>
        <button
          type="button"
          disabled={!form.role}
          onClick={() => setStep(2)}
          className="ml-auto block rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
        <div className="mb-3.5 text-sm font-bold text-[#2C7001]">
          Personal &amp; account details
        </div>
        <label htmlFor="firstName" className="text-xs text-slate-500">
          First Name
        </label>
        <input
          id="firstName"
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="middleName" className="text-xs text-slate-500">
          Middle Name
        </label>
        <input
          id="middleName"
          value={form.middleName}
          onChange={(e) => update("middleName", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="lastName" className="text-xs text-slate-500">
          Last Name
        </label>
        <input
          id="lastName"
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="jobTitle" className="text-xs text-slate-500">
          Job Title
        </label>
        <input
          id="jobTitle"
          value={form.jobTitle}
          onChange={(e) => update("jobTitle", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="department" className="text-xs text-slate-500">
          Department
        </label>
        <select
          id="department"
          aria-label="Department"
          value={form.departmentId}
          onChange={(e) => update("departmentId", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        >
          <option value="">Select...</option>
          {referenceData?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label htmlFor="businessUnit" className="text-xs text-slate-500">
          Business Unit
        </label>
        <select
          id="businessUnit"
          aria-label="Business Unit"
          value={form.businessUnitId}
          onChange={(e) => update("businessUnitId", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        >
          <option value="">Select...</option>
          {referenceData?.businessUnits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <label htmlFor="location" className="text-xs text-slate-500">
          Location
        </label>
        <select
          id="location"
          aria-label="Location"
          value={form.locationId}
          onChange={(e) => update("locationId", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        >
          <option value="">Select...</option>
          {referenceData?.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <label htmlFor="email" className="text-xs text-slate-500">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="mb-4 h-8 w-full border-b border-slate-300 bg-transparent text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="password" className="text-xs text-slate-500">
          Password
        </label>
        <PasswordInput
          id="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          wrapperClassName="mb-4"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="confirmPassword" className="text-xs text-slate-500">
          Confirm Password
        </label>
        <PasswordInput
          id="confirmPassword"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          wrapperClassName="mb-5"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500"
          >
            ← BACK
          </button>
          <button
            type="button"
            disabled={!registrationSchema.safeParse(form).success}
            onClick={() => setStep(3)}
            className="rounded-full bg-[#2C7001] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
      <div className="mb-3 text-sm font-bold text-[#2C7001]">
        Review &amp; confirm
      </div>
      <div className="mb-4 rounded border border-slate-100 bg-slate-50 p-4 text-xs leading-loose text-slate-600">
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
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500"
        >
          ← BACK
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="rounded-full bg-[#2C7001] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          SUBMIT REGISTRATION
        </button>
      </div>
    </div>
  );
}
