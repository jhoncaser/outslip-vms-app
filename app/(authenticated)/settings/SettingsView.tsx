"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

function MatrixTypeTable({ rows }: { rows: MatrixTypeRow[] }) {
  const columns = ["Matrix Code", "Matrix Type", "Creator", "Date Created"];
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow">
      <table className="w-full border-collapse text-left text-sm text-slate-600">
        <thead>
          <tr className="bg-[#2C7001]">
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
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                No matrix types yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
              >
                <td className="px-4 py-3">{row.matrixCode}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.creator}</td>
                <td className="px-4 py-3 text-slate-500">{row.createdAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ rows, label }: { rows: ReferenceRow[]; label: string }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow">
      <table className="w-full border-collapse text-left text-sm text-slate-600">
        <thead>
          <tr className="bg-[#2C7001]">
            <th className="px-4 py-3 text-xs font-bold text-white">{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500">
                No {label.toLowerCase()} values yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
              >
                <td className="px-4 py-3">{row.name}</td>
              </tr>
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
}: {
  matrixTypes: MatrixTypeRow[];
  departments: ReferenceRow[];
  businessUnits: ReferenceRow[];
  locations: ReferenceRow[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("matrixType");
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeLabel = TABS.find((tab) => tab.key === activeTab)!.label;

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
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">Settings</h1>
        <p className="text-xs text-slate-500">Manage setup values used across the app</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500 transition-all duration-150 ${
              activeTab === tab.key ? "border-l-[6px] bg-[#fbfdf9] text-[#2C7001]" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={openModal}
          className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Add {activeLabel}
        </button>
      </div>

      {activeTab === "matrixType" ? (
        <MatrixTypeTable rows={matrixTypes} />
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
                  id="settings-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
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
                    className="mb-1 block text-xs font-semibold text-slate-600"
                  >
                    Name
                  </label>
                  <input
                    id="setup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]"
                  />
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
