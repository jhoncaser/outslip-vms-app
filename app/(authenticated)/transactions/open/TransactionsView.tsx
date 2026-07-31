"use client";

import { Fragment, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";
import { VISITOR_TYPE_OPTIONS } from "@/lib/visitorTypeOptions";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";
import {
  TRANSACTION_FIELD_LABELS,
  findMissingRequiredField,
  getActiveFields,
  type TransactionFieldKey,
} from "@/lib/transactionFieldSets";

export type TransactionRow = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  plannedDate: string;
  plannedTime: string;
  returnTime: string;
  originBusinessUnit: string;
  enrouteBusinessUnits: string;
  reason: string;
  visitorType: string;
  personToMeet: string;
  department: string;
  location: string;
  transportType: string;
  plateNo: string;
  createdBy: string;
  statusName: string;
  createdAt: string;
};
export type MatrixTypeOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };

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


function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter();
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No open transactions yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => router.push(`/transactions/open/${row.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/transactions/open/${row.id}`);
                        }
                      }}
                      tabIndex={0}
                      className={`cursor-pointer border-b border-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C7001]/40 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEnlargedCode(row.transactionCode);
                          }}
                          className="h-12 w-12 overflow-hidden rounded border border-slate-200 transition-colors hover:border-[#2C7001] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
                        >
                          <img
                            src={row.qrDataUrl}
                            alt={`QR code for transaction ${row.transactionCode}`}
                            className="h-full w-full"
                          />
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{row.transactionCode}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.matrixTypeName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.createdBy}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {row.statusName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.createdAt}</td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {enlargedRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl">
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
                  id="qr-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {enlargedRow.transactionCode}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setEnlargedCode(null)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex justify-center px-8 py-7">
                <img
                  src={enlargedRow.qrDataUrl}
                  alt={`QR code for transaction ${enlargedRow.transactionCode}`}
                  className="h-56 w-56"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputClassName =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#2C7001] focus:outline-none focus:ring-1 focus:ring-[#2C7001]";
const labelClassName = "mb-1 block text-xs font-semibold text-slate-600";

export function TransactionsView({
  transactions,
  matrixTypes,
  currentUserBusinessUnit,
  departments,
}: {
  transactions: TransactionRow[];
  matrixTypes: MatrixTypeOption[];
  currentUserBusinessUnit: string;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [matrixTypeId, setMatrixTypeId] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [plannedTime, setPlannedTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [originBusinessUnit, setOriginBusinessUnit] = useState("");
  const [enrouteBusinessUnits, setEnrouteBusinessUnits] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [visitorType, setVisitorType] = useState("");
  const [personToMeet, setPersonToMeet] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [visitLocation, setVisitLocation] = useState("");
  const [transportType, setTransportType] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedTypeName = matrixTypes.find(
    (option) => option.id === matrixTypeId
  )?.name;
  const fieldValues: Record<TransactionFieldKey, string | string[]> = {
    plannedDate,
    plannedTime,
    returnTime,
    originBusinessUnit,
    enrouteBusinessUnits,
    reason,
    visitorType,
    personToMeet,
    departmentId,
    visitLocation,
    transportType,
    plateNo,
  };
  const activeFields: readonly TransactionFieldKey[] = selectedTypeName
    ? getActiveFields(selectedTypeName, fieldValues)
    : [];

  function openModal() {
    setMatrixTypeId("");
    setPlannedDate("");
    setPlannedTime("");
    setReturnTime("");
    setOriginBusinessUnit(
      (BUSINESS_UNIT_OPTIONS as readonly string[]).includes(currentUserBusinessUnit)
        ? currentUserBusinessUnit
        : ""
    );
    setEnrouteBusinessUnits([]);
    setReason("");
    setVisitorType("");
    setPersonToMeet("");
    setDepartmentId("");
    setVisitLocation("");
    setTransportType("");
    setPlateNo("");
    setError("");
    setModalOpen(true);
  }

  function toggleEnrouteBusinessUnit(option: string) {
    setEnrouteBusinessUnits((prev) =>
      prev.includes(option)
        ? prev.filter((value) => value !== option)
        : [...prev, option]
    );
  }

  function renderField(key: TransactionFieldKey) {
    switch (key) {
      case "plannedDate":
        return (
          <div>
            <label htmlFor="planned-date" className={labelClassName}>
              Planned Date
            </label>
            <input
              id="planned-date"
              type="date"
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "plannedTime":
        return (
          <div>
            <label htmlFor="planned-time" className={labelClassName}>
              Planned Time
            </label>
            <input
              id="planned-time"
              type="time"
              value={plannedTime}
              onChange={(event) => setPlannedTime(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "returnTime":
        return (
          <div>
            <label htmlFor="return-time" className={labelClassName}>
              Return Time
            </label>
            <input
              id="return-time"
              type="time"
              value={returnTime}
              onChange={(event) => setReturnTime(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "originBusinessUnit":
        return (
          <div>
            <label htmlFor="origin-business-unit" className={labelClassName}>
              Origin Business Unit
            </label>
            <select
              id="origin-business-unit"
              value={originBusinessUnit}
              onChange={(event) => setOriginBusinessUnit(event.target.value)}
              className={inputClassName}
            >
              <option value="" disabled>
                Select a business unit
              </option>
              {BUSINESS_UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      case "enrouteBusinessUnits":
        return (
          <fieldset>
            <legend className={labelClassName}>Enroute to Other Business Unit</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded border border-slate-300 p-3">
              {BUSINESS_UNIT_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={enrouteBusinessUnits.includes(option)}
                    onChange={() => toggleEnrouteBusinessUnit(option)}
                    className="h-4 w-4 rounded border-slate-300 text-[#2C7001] focus:ring-1 focus:ring-[#2C7001]"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "reason":
        return (
          <div>
            <label htmlFor="reason" className={labelClassName}>
              Reason
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "visitorType":
        return (
          <div>
            <label htmlFor="visitor-type" className={labelClassName}>
              Visitor Type
            </label>
            <select
              id="visitor-type"
              value={visitorType}
              onChange={(event) => setVisitorType(event.target.value)}
              className={inputClassName}
            >
              <option value="" disabled>
                Select a visitor type
              </option>
              {VISITOR_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      case "personToMeet":
        return (
          <div>
            <label htmlFor="person-to-meet" className={labelClassName}>
              Person to Meet
            </label>
            <input
              id="person-to-meet"
              type="text"
              value={personToMeet}
              onChange={(event) => setPersonToMeet(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "departmentId":
        return (
          <div>
            <label htmlFor="visitor-department" className={labelClassName}>
              Department
            </label>
            <select
              id="visitor-department"
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
        );
      case "visitLocation":
        return (
          <div>
            <label htmlFor="visit-location" className={labelClassName}>
              Location
            </label>
            <input
              id="visit-location"
              type="text"
              value={visitLocation}
              onChange={(event) => setVisitLocation(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
      case "transportType":
        return (
          <div>
            <label htmlFor="transport-type" className={labelClassName}>
              Transport Type
            </label>
            <select
              id="transport-type"
              value={transportType}
              onChange={(event) => {
                const value = event.target.value;
                setTransportType(value);
                if (value === "Walk-In") setPlateNo("");
              }}
              className={inputClassName}
            >
              <option value="" disabled>
                Select a transport type
              </option>
              {TRANSPORT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      case "plateNo":
        return (
          <div>
            <label htmlFor="plate-no" className={labelClassName}>
              Plate No.
            </label>
            <input
              id="plate-no"
              type="text"
              value={plateNo}
              onChange={(event) => setPlateNo(event.target.value)}
              className={inputClassName}
            />
          </div>
        );
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!selectedTypeName) return;

    const missingField = findMissingRequiredField(selectedTypeName, fieldValues);
    if (missingField) {
      setError(
        `${TRANSACTION_FIELD_LABELS[missingField]} is required for this transaction type`
      );
      return;
    }

    setSubmitting(true);

    const body: Record<string, unknown> = { matrixTypeId };
    for (const key of activeFields) {
      body[key] = fieldValues[key];
    }

    const response = await fetch("/api/transactions", {
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Open Transaction</h1>
          <p className="text-xs text-slate-500">Filed requests awaiting further action</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Add Transaction
        </button>
      </div>

      <TransactionsTable rows={transactions} />

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-modal-title"
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
                  id="transaction-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  ADD TRANSACTION
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
              <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-8 py-7">
                <div>
                  <label htmlFor="transaction-type" className={labelClassName}>
                    Transaction Type
                  </label>
                  <select
                    id="transaction-type"
                    required
                    value={matrixTypeId}
                    onChange={(event) => setMatrixTypeId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="" disabled>
                      Select a transaction type
                    </option>
                    {matrixTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                {activeFields.map((key) => (
                  <Fragment key={key}>{renderField(key)}</Fragment>
                ))}

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
