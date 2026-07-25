"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

const labelClassName = "mb-1 block text-xs font-semibold text-slate-600";
const inputClassName =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";
const filterClassName =
  "rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";

export function MatrixTypeApproverDetail({
  matrixType,
  assignments,
  users,
  departments,
  businessUnits,
  locations,
  onBack,
}: {
  matrixType: { id: string; matrixCode: string; name: string };
  assignments: ApproverAssignmentRow[];
  users: UserOption[];
  departments: OptionRow[];
  businessUnits: OptionRow[];
  locations: OptionRow[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [level, setLevel] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filtered = assignments.filter((row) => {
    if (businessUnitFilter && row.businessUnit !== businessUnitFilter) return false;
    if (locationFilter && row.location !== locationFilter) return false;
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
    router.refresh();
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-xs font-semibold text-[#2C7001] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40 rounded"
      >
        ← Settings / Matrix Type
      </button>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-8 py-6">
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
            <h2 className="text-lg font-extrabold tracking-widest text-white">
              {matrixType.name.toUpperCase()}
            </h2>
            <p className="mt-1 text-xs text-white/80">
              {matrixType.matrixCode} · Approver setup
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="rounded-full bg-white/15 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            + Add Approver
          </button>
        </div>
      </div>

      <div className="my-4 flex gap-3">
        <select
          aria-label="Filter by Business Unit"
          value={businessUnitFilter}
          onChange={(event) => setBusinessUnitFilter(event.target.value)}
          className={filterClassName}
        >
          <option value="">Business Unit: All</option>
          {businessUnits.map((bu) => (
            <option key={bu.id} value={bu.name}>
              {bu.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Location"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          className={filterClassName}
        >
          <option value="">Location: All</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
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
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No approvers assigned yet.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                >
                  <td className="px-4 py-3">{row.approverName}</td>
                  <td className="px-4 py-3">{row.level}</td>
                  <td className="px-4 py-3">{row.department}</td>
                  <td className="px-4 py-3">{row.businessUnit}</td>
                  <td className="px-4 py-3">{row.location}</td>
                </tr>
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
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
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
                  className="text-lg font-extrabold tracking-widest text-white"
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
                  <p role="alert" className="text-xs text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] disabled:pointer-events-none disabled:opacity-60"
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
