"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { fieldLabel, fieldUnderline, buttonPrimary } from "@/lib/deepForest";

export function ChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      setShowToast(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#57e34c] bg-[#0f1c0c] px-4 py-3 text-sm font-semibold text-[#86efac] shadow-[0_0_30px_rgba(87,227,76,0.3)]"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#3a9d0a] text-xs text-white">
            ✓
          </span>
          Password Updated!
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor="newPassword" className={fieldLabel}>
          New Password
        </label>
        <PasswordInput
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          wrapperClassName="mb-4"
          inputClassName={`h-8 ${fieldUnderline} pr-9`}
        />

        <label htmlFor="confirmPassword" className={fieldLabel}>
          Confirm Password
        </label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          wrapperClassName="mb-5"
          inputClassName={`h-8 ${fieldUnderline} pr-9`}
        />

        {error && (
          <p role="alert" className="mb-3 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`mx-auto ${buttonPrimary} px-10`}
        >
          UPDATE PASSWORD
        </button>
      </form>
    </>
  );
}
