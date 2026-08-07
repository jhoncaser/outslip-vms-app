"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  MatrixTypeApproverDetail,
  type ApproverAssignmentRow,
  type UserOption,
} from "./MatrixTypeApproverDetail";
import { tableWrap, tableHeaderRow, mutedText, headingText, fieldLabel, fieldBox, buttonPrimary, modalHeader, modalCard } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";

export type ReferenceRow = { id: string; name: string };
export type MatrixTypeRow = {
  id: string;
  matrixCode: string;
  name: string;
  creator: string;
  createdAt: string;
};

type TabKey = "matrixType" | "department" | "businessUnit" | "location";

const TABS: { key: TabKey; label: string }[] = [
  { key: "matrixType", label: "Matrix Type" },
  { key: "department", label: "Department" },
  { key: "businessUnit", label: "Business Unit" },
  { key: "location", label: "Location" },
];

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

function MatrixTypeTable({
  rows,
  onSelect,
}: {
  rows: MatrixTypeRow[];
  onSelect: (row: MatrixTypeRow) => void;
}) {
  const columns = ["Matrix Code", "Matrix Type", "Creator", "Date Created"];
  return (
    <div className={tableWrap}>
      <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
        <thead>
          <tr className={tableHeaderRow}>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-xs font-bold text-white">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`px-4 py-8 text-center ${mutedText}`}>
                No matrix types yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <RevealRow
                key={row.id}
                index={index}
                onClick={() => onSelect(row)}
                className="cursor-pointer"
              >
                <td className="px-4 py-3 text-[#eafbe4]">{row.matrixCode}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="rounded font-semibold text-[#7be36f] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/40"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#eafbe4]">{row.creator}</td>
                <td className={`px-4 py-3 ${mutedText}`}>{row.createdAt}</td>
              </RevealRow>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ rows, label }: { rows: ReferenceRow[]; label: string }) {
  return (
    <div className={tableWrap}>
      <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
        <thead>
          <tr className={tableHeaderRow}>
            <th className="px-4 py-3 text-xs font-bold text-white">{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`px-4 py-8 text-center ${mutedText}`}>
                No {label.toLowerCase()} values yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <RevealRow key={row.id} index={index}>
                <td className="px-4 py-3 text-[#eafbe4]">{row.name}</td>
              </RevealRow>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsView({
  matrixTypes,
  departments,
  businessUnits,
  locations,
  approverAssignments,
  users,
  canEdit,
}: {
  matrixTypes: MatrixTypeRow[];
  departments: ReferenceRow[];
  businessUnits: ReferenceRow[];
  locations: ReferenceRow[];
  approverAssignments: ApproverAssignmentRow[];
  users: UserOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("matrixType");
  const [selectedMatrixTypeId, setSelectedMatrixTypeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeLabel = TABS.find((tab) => tab.key === activeTab)!.label;
  const selectedMatrixType = matrixTypes.find((mt) => mt.id === selectedMatrixTypeId) ?? null;

  function openModal() {
    setName("");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const endpoint =
      activeTab === "matrixType" ? "/api/matrix-types" : "/api/reference-data";
    const body =
      activeTab === "matrixType" ? { name } : { type: activeTab, name };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      {selectedMatrixType ? (
        <MatrixTypeApproverDetail
          matrixType={selectedMatrixType}
          assignments={approverAssignments.filter(
            (row) => row.matrixTypeId === selectedMatrixType.id
          )}
          users={users}
          departments={departments}
          businessUnits={businessUnits}
          locations={locations}
          canEdit={canEdit}
          onBack={() => setSelectedMatrixTypeId(null)}
        />
      ) : (
        <>
          <div className="mb-4">
            <h1 className={`text-lg ${headingText}`}>Settings</h1>
            <p className={`text-xs ${mutedText}`}>Manage setup values used across the app</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded border border-l-4 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide transition-all duration-150 ${
                  activeTab === tab.key
                    ? "border-[#57e34c] border-l-[6px] bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white shadow-[0_0_20px_rgba(87,227,76,0.35)]"
                    : "border-[#4ca71a]/25 border-l-[#3a9d0a] bg-[#141e12]/60 text-[#9db894] hover:bg-[#1a241a]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {canEdit && (
            <div className="mb-4">
              <button
                type="button"
                onClick={openModal}
                className={`${buttonPrimary} px-5 py-2 text-xs`}
              >
                + Add {activeLabel}
              </button>
            </div>
          )}

          {activeTab === "matrixType" ? (
            <MatrixTypeTable
              rows={matrixTypes}
              onSelect={(row) => setSelectedMatrixTypeId(row.id)}
            />
          ) : (
            <SimpleTable
              label={activeLabel}
              rows={
                activeTab === "department"
                  ? departments
                  : activeTab === "businessUnit"
                    ? businessUnits
                    : locations
              }
            />
          )}

          {modalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
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
                      id="settings-modal-title"
                      className={`text-lg tracking-widest ${headingText}`}
                    >
                      ADD {activeLabel.toUpperCase()}
                    </h2>
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
                      <label
                        htmlFor="setup-name"
                        className={`mb-1 block ${fieldLabel}`}
                      >
                        Name
                      </label>
                      <input
                        id="setup-name"
                        type="text"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className={fieldBox}
                      />
                    </div>
                    {error && (
                      <p role="alert" className="text-xs text-red-400">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full ${buttonPrimary}`}
                    >
                      {submitting ? "Saving…" : "Save"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
