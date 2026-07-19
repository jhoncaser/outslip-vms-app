"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";

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
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-[#2C7001] bg-white px-4 py-3 text-sm font-semibold text-[#1d4d00] shadow-lg"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#2C7001] text-xs text-white">
            ✓
          </span>
          Password Updated!
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor="newPassword" className="text-xs text-slate-500">
          New Password
        </label>
        <PasswordInput
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          wrapperClassName="mb-4"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />

        <label htmlFor="confirmPassword" className="text-xs text-slate-500">
          Confirm Password
        </label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          wrapperClassName="mb-5"
          inputClassName="h-8 w-full border-b border-slate-300 bg-transparent pr-9 text-sm focus:border-[#2C7001] focus:outline-none"
        />

        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mx-auto rounded-full bg-[#2C7001] px-10 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
        >
          UPDATE PASSWORD
        </button>
      </form>
    </>
  );
}
