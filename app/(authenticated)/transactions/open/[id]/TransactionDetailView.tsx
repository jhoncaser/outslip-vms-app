"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EMPLOYEE_TYPE_OPTIONS,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "@/lib/validation/transactionLineItem";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export type TransactionDetailData = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  statusName: string;
  createdBy: string;
  createdAt: string;
  detailFields: { label: string; value: string }[];
};

export type LineItemRow = {
  id: string;
  variant: "visitor-pass" | "employee";
  visitorName: string;
  jobTitle: string;
  company: string;
  contactNumber: string;
  emailAddress: string;
  transportType: string;
  plateNo: string;
  uploadFileName: string;
  hasFile: boolean;
  employeeType: string;
  employeeId: string;
  employeeName: string;
  jobPosition: string;
  department: string;
  businessUnit: string;
  remarks: string;
};

export type EmployeeOption = {
  id: string;
  name: string;
  jobPosition: string;
  department: string;
  businessUnit: string;
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; lineItem: LineItemRow };

const VISITOR_PASS_COLUMNS = [
  "Visitor Name",
  "Job Title",
  "Company",
  "Contact #",
  "Transport Type",
  "Plate No.",
  "File",
  "Actions",
];

const EMPLOYEE_COLUMNS = [
  "Type",
  "Name",
  "Job Position",
  "Department",
  "Business Unit",
  "Remarks",
  "Actions",
];

export type ApproverRow = {
  id: string;
  level: number;
  approverName: string;
  initials: string;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "1st Level",
  2: "2nd Level",
  3: "3rd Level",
};

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

export function TransactionDetailView({
  transaction,
  lineItems,
  employees,
  remarksDefault,
  approvers = [],
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
  approvers?: ApproverRow[];
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const columns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;

  const approversByLevel = new Map<number, ApproverRow[]>();
  for (const approver of approvers) {
    const group = approversByLevel.get(approver.level) ?? [];
    group.push(approver);
    approversByLevel.set(approver.level, group);
  }
  const levelsWithApprovers = [1, 2, 3].filter(
    (level) => (approversByLevel.get(level)?.length ?? 0) > 0
  );

  const [deleteTarget, setDeleteTarget] = useState<LineItemRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });

  // Visitor Pass fields
  const [visitorName, setVisitorName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [transportType, setTransportType] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Employee-variant fields
  const [employeeType, setEmployeeType] = useState<(typeof EMPLOYEE_TYPE_OPTIONS)[number]>(
    "Mega Employee"
  );
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState(remarksDefault);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openCreateModal() {
    setVisitorName("");
    setJobTitle("");
    setCompany("");
    setContactNumber("");
    setEmailAddress("");
    setTransportType("");
    setPlateNo("");
    setUploadFile(null);
    setEmployeeType("Mega Employee");
    setEmployeeId("");
    setName("");
    setRemarks(remarksDefault);
    setError("");
    setModal({ mode: "create" });
  }

  function openEditModal(item: LineItemRow) {
    setVisitorName(item.visitorName);
    setJobTitle(item.jobTitle);
    setCompany(item.company);
    setContactNumber(item.contactNumber);
    setEmailAddress(item.emailAddress);
    setTransportType(item.transportType);
    setPlateNo(item.plateNo);
    setUploadFile(null);
    setEmployeeType(
      (item.employeeType as (typeof EMPLOYEE_TYPE_OPTIONS)[number]) || "Mega Employee"
    );
    setEmployeeId(item.employeeId);
    setName(item.employeeType && item.employeeType !== "Mega Employee" ? item.employeeName : "");
    setRemarks(item.remarks);
    setError("");
    setModal({ mode: "edit", lineItem: item });
  }

  const selectedEmployee = employees.find((option) => option.id === employeeId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (isVisitorPass) {
      const missingField = findMissingVisitorPassLineItemField({
        visitorName,
        jobTitle,
        company,
        transportType,
        plateNo,
      });
      if (missingField) {
        return setError(`${VISITOR_PASS_LINE_ITEM_LABELS[missingField]} is required`);
      }
    } else {
      const missingField = findMissingEmployeeLineItemField({
        employeeType,
        employeeId,
        name,
        remarks,
      });
      if (missingField) {
        return setError(`${EMPLOYEE_LINE_ITEM_LABELS[missingField]} is required`);
      }
    }

    setSubmitting(true);
    const body = new FormData();
    if (isVisitorPass) {
      body.set("visitorName", visitorName);
      body.set("jobTitle", jobTitle);
      body.set("company", company);
      if (contactNumber) body.set("contactNumber", contactNumber);
      if (emailAddress) body.set("emailAddress", emailAddress);
      body.set("transportType", transportType);
      if (transportType !== "Walk-In" && plateNo) body.set("plateNo", plateNo);
      if (uploadFile) body.set("uploadFile", uploadFile);
    } else {
      body.set("employeeType", employeeType);
      if (employeeType === "Mega Employee") body.set("employeeId", employeeId);
      else body.set("name", name);
      body.set("remarks", remarks);
    }

    const url =
      modal.mode === "edit"
        ? `/api/transactions/${transaction.id}/line-items/${modal.lineItem.id}`
        : `/api/transactions/${transaction.id}/line-items`;

    try {
      const response = await fetch(url, {
        method: modal.mode === "edit" ? "PATCH" : "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      setModal({ mode: "closed" });
      router.refresh();
    } catch (err) {
      setError("An error occurred while saving the line item");
      setSubmitting(false);
    }
  }

  function openDeleteModal(item: LineItemRow) {
    setDeleteModalError("");
    setDeleteTarget(item);
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteModalError("");
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteModalError("");
    setDeleteSubmitting(true);

    try {
      const response = await fetch(
        `/api/transactions/${transaction.id}/line-items/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setDeleteModalError(data.error ?? "Failed to delete line item");
        setDeleteSubmitting(false);
        return;
      }

      setDeleteSubmitting(false);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteModalError("An error occurred while deleting the line item");
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <Link
        href="/transactions/open"
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#cfe3c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C7001] transition-colors duration-150 hover:border-[#2C7001] hover:bg-[#f2f8ee] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none"
      >
        <BackIcon />
        Back
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow sm:flex-row sm:items-start">
        <img
          src={transaction.qrDataUrl}
          alt={`QR code for transaction ${transaction.transactionCode}`}
          className="h-28 w-28 shrink-0 rounded border border-slate-200"
        />
        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Code</p>
            <p className="text-sm text-slate-800">{transaction.transactionCode}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Transaction Type
            </p>
            <p className="text-sm text-slate-800">{transaction.matrixTypeName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="text-sm text-slate-800">{transaction.statusName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Created By
            </p>
            <p className="text-sm text-slate-800">{transaction.createdBy}</p>
          </div>
          {transaction.detailFields.map((field) => (
            <div key={field.label}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {field.label}
              </p>
              <p className="text-sm text-slate-800">{field.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">
          {isVisitorPass ? "Visitor Lists" : "Employee/Visitor Lists"}{" "}
          <span className="font-normal text-slate-400">({lineItems.length})</span>
        </h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
        >
          + Add Line Item
        </button>
      </div>

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
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No line items yet.
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                >
                  {isVisitorPass ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">{item.visitorName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.jobTitle}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.company}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.contactNumber || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.transportType}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.plateNo || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.hasFile ? (
                          <a
                            href={`/api/line-items/${item.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2C7001] hover:underline"
                          >
                            📎 {item.uploadFileName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {item.employeeType}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{item.employeeName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.jobPosition}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.department}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.businessUnit}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.remarks}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openEditModal(item)}
                      className="mr-2 inline-block text-slate-400 transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-[#2C7001] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openDeleteModal(item)}
                      className="inline-block text-slate-400 transition-transform duration-150 hover:-translate-y-0.5 hover:scale-125 hover:text-red-600 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isVisitorPass && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">
              👤 List Approvers{" "}
              <span className="font-normal text-slate-400">({approvers.length})</span>
            </h2>
          </div>
          <div className="rounded-xl bg-white p-6 shadow">
            {approvers.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                No approvers configured for this Department + Business Unit + Location.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {levelsWithApprovers.map((level) => (
                  <div key={level}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {LEVEL_LABELS[level]}{" "}
                      <span className="font-normal normal-case text-slate-400">
                        ({approversByLevel.get(level)!.length})
                      </span>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {approversByLevel.get(level)!.map((approver) => (
                        <div key={approver.id} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0df] text-xs font-bold text-[#2C7001]">
                            {approver.initials}
                          </span>
                          <span className="text-sm text-slate-700">{approver.approverName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modal.mode !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="line-item-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
                <h2
                  id="line-item-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {modal.mode === "edit" ? "EDIT LINE ITEM" : "ADD LINE ITEM"}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModal({ mode: "closed" })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className="max-h-[70vh] space-y-4 overflow-y-auto px-8 py-7"
              >
                {isVisitorPass ? (
                  <>
                    <div>
                      <label htmlFor="visitor-name" className="mb-1 block text-xs font-semibold text-slate-600">
                        Visitor Name
                      </label>
                      <input
                        id="visitor-name"
                        type="text"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="job-title" className="mb-1 block text-xs font-semibold text-slate-600">
                        Job Title
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="company" className="mb-1 block text-xs font-semibold text-slate-600">
                        Company
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-number" className="mb-1 block text-xs font-semibold text-slate-600">
                        Contact #
                      </label>
                      <input
                        id="contact-number"
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="email-address" className="mb-1 block text-xs font-semibold text-slate-600">
                        Email Address
                      </label>
                      <input
                        id="email-address"
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="upload-file" className="mb-1 block text-xs font-semibold text-slate-600">
                        Upload File
                      </label>
                      <input
                        id="upload-file"
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="transport-type" className="mb-1 block text-xs font-semibold text-slate-600">
                        Transport Type
                      </label>
                      <select
                        id="transport-type"
                        value={transportType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTransportType(value);
                          if (value === "Walk-In") setPlateNo("");
                        }}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
                    {transportType !== "Walk-In" && (
                      <div>
                        <label htmlFor="plate-no" className="mb-1 block text-xs font-semibold text-slate-600">
                          Plate No.
                        </label>
                        <input
                          id="plate-no"
                          type="text"
                          value={plateNo}
                          onChange={(e) => setPlateNo(e.target.value)}
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">
                        Employee Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {EMPLOYEE_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setEmployeeType(option)}
                            className={`rounded border px-3 py-2 text-xs font-semibold ${
                              employeeType === option
                                ? "border-[#2C7001] bg-[#2C7001] text-white"
                                : "border-slate-300 text-slate-600"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    {employeeType === "Mega Employee" ? (
                      <>
                        <div>
                          <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-600">
                            Name
                          </label>
                          <select
                            id="name"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="" disabled>
                              Select an employee
                            </option>
                            {employees.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Job Position
                          </label>
                          <div className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            {selectedEmployee?.jobPosition ?? ""}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Department
                          </label>
                          <div className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            {selectedEmployee?.department ?? ""}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Business Unit
                          </label>
                          {selectedEmployee && (
                            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              {selectedEmployee.businessUnit}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-600">
                          Name
                        </label>
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="remarks" className="mb-1 block text-xs font-semibold text-slate-600">
                        Remarks
                      </label>
                      <input
                        id="remarks"
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p role="alert" className="text-xs text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-line-item-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-6"
        >
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl">
              ⚠️
            </div>
            <h2
              id="delete-line-item-modal-title"
              className="mb-2 text-sm font-extrabold text-slate-800"
            >
              Delete this line item?
            </h2>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left">
              <p className="text-xs font-bold text-slate-800">
                {isVisitorPass
                  ? deleteTarget.visitorName
                  : `${deleteTarget.employeeType} — ${deleteTarget.employeeName}`}
              </p>
              {isVisitorPass && (
                <p className="text-[11px] text-slate-400">
                  {deleteTarget.jobTitle} · {deleteTarget.company}
                </p>
              )}
            </div>
            <p className="mb-4 text-xs text-slate-500">This action cannot be undone.</p>
            {deleteModalError && (
              <p role="alert" className="mb-3 text-xs text-red-600">
                {deleteModalError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteSubmitting}
                className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-slate-200 active:translate-y-0 active:bg-slate-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-slate-300 disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-[0_8px_18px_rgba(220,38,38,0.35)] active:translate-y-0 active:bg-red-800 active:shadow-[0_3px_8px_rgba(220,38,38,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-300 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
