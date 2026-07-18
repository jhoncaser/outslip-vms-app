"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmPassword }),
    });

    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <label htmlFor="newPassword" className="text-xs text-slate-500">
        New Password
      </label>
      <input
        id="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        className="mb-3 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <label htmlFor="confirmPassword" className="text-xs text-slate-500">
        Confirm Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        className="mb-4 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[#0b2545] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        UPDATE PASSWORD
      </button>
    </form>
  );
}
