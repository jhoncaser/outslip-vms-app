"use client";

import { buttonSecondary } from "@/lib/deepForest";

export function CancelTransactionModal({
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
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-red-500/30 bg-[#1a0f0f] p-6 text-center shadow-[0_0_40px_rgba(248,113,113,0.25)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-xl">
          ⚠️
        </div>
        <h2
          id="cancel-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Delete this transaction?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-4 text-xs text-[#9db894]">
          This will cancel the transaction and move it to Canceled Transactions — this cannot be undone.
        </p>
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {error}
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
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-full bg-red-600/80 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-[0_8px_18px_rgba(220,38,38,0.35)] active:translate-y-0 active:bg-red-700 active:shadow-[0_3px_8px_rgba(220,38,38,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-400/50 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
