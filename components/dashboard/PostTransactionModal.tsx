"use client";

import { buttonPrimary, buttonSecondary } from "@/lib/deepForest";

export function PostTransactionModal({
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
      aria-labelledby="post-transaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] p-6 text-center shadow-[0_0_40px_rgba(44,112,1,0.3)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#57e34c]/18 text-xl">
          📮
        </div>
        <h2
          id="post-transaction-modal-title"
          className="mb-2 text-sm font-extrabold text-white"
        >
          Post this transaction?
        </h2>
        <div className="mb-3 rounded-lg border border-[#4ca71a]/25 bg-[#0f1611]/40 px-3 py-2 text-left">
          <p className="text-xs font-bold text-[#eafbe4]">{transactionCode}</p>
          <p className="text-[11px] text-[#6f8a68]">{matrixTypeName}</p>
        </div>
        <p className="mb-4 text-xs text-[#9db894]">
          You won&apos;t be able to add, edit, or delete line items until you unpost it.
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
            className={`flex-1 ${buttonPrimary} px-4 py-2 text-xs`}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
