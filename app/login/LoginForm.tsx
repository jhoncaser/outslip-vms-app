"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { fieldLabel, fieldUnderline, buttonPrimary } from "@/lib/deepForest";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }

      router.push(body.mustChangePassword ? "/change-password" : "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="toast-fade-in fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border-l-4 border-red-500 bg-[#1a0f0f] px-4 py-3 text-sm font-semibold text-red-300 shadow-[0_0_30px_rgba(248,113,113,0.25)]"
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            !
          </span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="mb-5 flex items-center gap-4">
          <label
            htmlFor="email"
            className={`w-20 shrink-0 ${fieldLabel}`}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter email"
            className={fieldUnderline}
          />
        </div>

        <div className="mb-2 flex items-center gap-4">
          <label
            htmlFor="password"
            className={`w-20 shrink-0 ${fieldLabel}`}
          >
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter password"
            inputClassName={`${fieldUnderline} pr-9`}
          />
        </div>

        <a href="#" className="mb-6 self-end text-xs font-semibold text-[#7be36f]">
          Forgot Password?
        </a>

        <button
          type="submit"
          disabled={submitting}
          className={`mx-auto ${buttonPrimary} px-12`}
        >
          Login
        </button>
      </form>
    </>
  );
}
