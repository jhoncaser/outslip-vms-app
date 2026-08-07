"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { tableWrap, tableHeaderRow, mutedText, modalHeader, modalCard, headingText } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";

export type ApproverAssignmentRow = {
  id: string;
  matrixTypeId: string;
  approverName: string;
  level: number;
  department: string;
  businessUnit: string;
  location: string;
};
export type UserOption = { id: string; name: string };
type OptionRow = { id: string; name: string };

function CloseIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

const labelClassName = "mb-1 block text-xs font-semibold text-[#9db894]";
const inputClassName =
  "w-full rounded border border-[#4ca71a]/40 bg-[#0f1611] px-3 py-2 text-sm text-[#eafbe4] focus:border-[#57e34c] focus:outline-none focus:ring-1 focus:ring-[#57e34c]";
const filterButtonClassName =
  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35";
const filterButtonActiveClassName =
  "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white";
const filterButtonInactiveClassName =
  "border border-[#4ca71a]/40 bg-transparent text-[#cfe9c7] hover:border-[#57e34c] hover:bg-[#57e34c]/10";

export function MatrixTypeApproverDetail({
  matrixType,
  assignments,
  users,
  departments,
  businessUnits,
  locations,
  canEdit,
  onBack,
}: {
  matrixType: { id: string; matrixCode: string; name: string };
  assignments: ApproverAssignmentRow[];
  users: UserOption[];
  departments: OptionRow[];
  businessUnits: OptionRow[];
  locations: OptionRow[];
  canEdit: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [level, setLevel] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 2500);
    return () => clearTimeout(timer);
  }, [showToast]);

  const filtered = assignments.filter((row) => {
    if (businessUnitFilter && row.businessUnit !== businessUnitFilter) return false;
    return true;
  });

  function openModal() {
    setApproverId("");
    setLevel("");
    setDepartmentId("");
    setBusinessUnitId("");
    setLocationId("");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/matrix-type-approvers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matrixTypeId: matrixType.id,
        approverId,
        level: Number(level),
        departmentId,
        businessUnitId,
        locationId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setModalOpen(false);
    setShowToast(true);
    router.refresh();
  }

  return (
    <div className="w-full">
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#57e34c] bg-[#0f1c0c] px-4 py-3 text-sm font-semibold text-[#86efac] shadow-[0_0_30px_rgba(87,227,76,0.3)]"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#57e34c] text-xs text-[#0f1611]">
            ✓
          </span>
          Approver Added!
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
      >
        <BackIcon />
        Back
      </button>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-8 py-6">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
        />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className={`text-lg tracking-widest ${headingText}`}>
              {matrixType.name.toUpperCase()}
            </h2>
            <p className="mt-1 text-xs text-white/80">
              {matrixType.matrixCode} · Approver setup
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openModal}
              className="rounded-full bg-white/15 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              + Add Approver
            </button>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by Business Unit"
        className="my-4 flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={businessUnitFilter === ""}
          onClick={() => setBusinessUnitFilter("")}
          className={`${filterButtonClassName} ${
            businessUnitFilter === "" ? filterButtonActiveClassName : filterButtonInactiveClassName
          }`}
        >
          All
        </button>
        {businessUnits.map((bu) => (
          <button
            key={bu.id}
            type="button"
            aria-pressed={businessUnitFilter === bu.name}
            onClick={() => setBusinessUnitFilter(bu.name)}
            className={`${filterButtonClassName} ${
              businessUnitFilter === bu.name
                ? filterButtonActiveClassName
                : filterButtonInactiveClassName
            }`}
          >
            {bu.name}
          </button>
        ))}
      </div>

      <div className={tableWrap}>
        <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
          <thead>
            <tr className={tableHeaderRow}>
              {["Approver", "Level", "Department", "Business Unit", "Location"].map(
                (column) => (
                  <th key={column} className="px-4 py-3 text-xs font-bold text-white">
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedText}`}>
                  No approvers assigned yet.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <RevealRow key={row.id} index={index}>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.approverName}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.level}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.department}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.businessUnit}</td>
                  <td className="px-4 py-3 text-[#eafbe4]">{row.location}</td>
                </RevealRow>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approver-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className={`max-w-[420px] ${modalCard}`}>
              <div className={modalHeader}>
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
                />
                <div
                  aria-hidden
                  className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
                />
                <h2
                  id="approver-modal-title"
                  className={`text-lg tracking-widest ${headingText}`}
                >
                  ADD APPROVER
                </h2>
                <p className="mt-1 text-xs text-white/80">{matrixType.name}</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModalOpen(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 px-8 py-7">
                <div>
                  <label htmlFor="approver-user" className={labelClassName}>
                    Approver
                  </label>
                  <select
                    id="approver-user"
                    required
                    value={approverId}
                    onChange={(event) => setApproverId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a user
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-level" className={labelClassName}>
                    Level
                  </label>
                  <select
                    id="approver-level"
                    required
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a level
                    </option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-department" className={labelClassName}>
                    Department
                  </label>
                  <select
                    id="approver-department"
                    required
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a department
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-business-unit" className={labelClassName}>
                    Business Unit
                  </label>
                  <select
                    id="approver-business-unit"
                    required
                    value={businessUnitId}
                    onChange={(event) => setBusinessUnitId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a business unit
                    </option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="approver-location" className={labelClassName}>
                    Location
                  </label>
                  <select
                    id="approver-location"
                    required
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a location
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] disabled:pointer-events-none disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
