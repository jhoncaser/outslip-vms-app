"use client";

import { useState } from "react";
import { buttonSecondary } from "@/lib/deepForest";

export function ReviseTransactionModal({
  transactionCode,
  matrixTypeName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  transactionCode: string;
  matrixTypeName: string;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("A reason is required.");
      return;
    }
    setValidationError("");
    onConfirm(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revise-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[360px] overflow-hidden rounded-xl border border-[#fbbf24]/35 bg-[#0c120a] p-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.2)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fbbf24]/18 text-xl">
          ✏️
        </div>
        <h2
          id="revise-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Send back for revision?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-3 text-xs text-[#9db894]">
          The transaction reopens for editing. Earlier approvals stay in place — only your level
          (and any above it) will need to re-approve once resubmitted.
        </p>
        <div className="mb-3 text-left">
          <label
            htmlFor="revise-transaction-reason"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#cfe9c7]"
          >
            Reason (shown to the creator)
          </label>
          <textarea
            id="revise-transaction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            className="w-full rounded border border-[#fbbf24]/40 bg-[#0f1611] px-2 py-1.5 text-xs text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#fbbf24] focus:outline-none disabled:opacity-60"
            rows={3}
            placeholder="e.g. Planned Time doesn't match the actual shift start..."
          />
        </div>
        {(validationError || error) && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {validationError || error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`flex-1 ${buttonSecondary} px-4 py-2 text-xs`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#b45309] px-4 py-2 text-xs font-semibold text-[#1a1206] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(251,191,36,0.35)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#fbbf24]/50 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {submitting ? "Sending…" : "Send for Revision"}
          </button>
        </div>
      </div>
    </div>
  );
}
