"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const VISITOR_PASS_COLUMNS = [
  "Visitor Name",
  "Job Title",
  "Company",
  "Contact #",
  "Transport Type",
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

export function TransactionDetailView({
  transaction,
  lineItems,
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const columns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete(lineItemId: string) {
    if (!confirm("Delete this line item?")) return;
    setDeleteError("");

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/line-items/${lineItemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setDeleteError(data.error ?? "Failed to delete line item");
        return;
      }

      router.refresh();
    } catch (err) {
      setDeleteError("An error occurred while deleting the line item");
    }
  }

  return (
    <div className="w-full">
      <Link
        href="/transactions/open"
        className="mb-4 inline-block text-xs font-semibold text-[#2C7001] hover:underline"
      >
        ← Back to Open Transactions
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
      </div>

      {deleteError && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {deleteError}
        </p>
      )}

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
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-red-600"
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
    </div>
  );
}
