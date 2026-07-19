"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";

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
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="mb-5 flex items-center gap-4">
        <label
          htmlFor="email"
          className="w-20 shrink-0 text-[13px] text-slate-500"
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
          className="w-full border-b border-slate-300 bg-transparent pb-1.5 text-sm placeholder:text-slate-300 focus:border-[#2C7001] focus:outline-none"
        />
      </div>

      <div className="mb-2 flex items-center gap-4">
        <label
          htmlFor="password"
          className="w-20 shrink-0 text-[13px] text-slate-500"
        >
          Password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter password"
          inputClassName="w-full border-b border-slate-300 bg-transparent pb-1.5 pr-9 text-sm placeholder:text-slate-300 focus:border-[#2C7001] focus:outline-none"
        />
      </div>

      <a href="#" className="mb-6 self-end text-xs font-semibold text-[#2C7001]">
        Forgot Password?
      </a>

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mx-auto rounded-full bg-[#2C7001] px-12 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
      >
        Login
      </button>
    </form>
  );
}
