"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <label htmlFor="email" className="text-xs text-slate-500">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="mb-3 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <label htmlFor="password" className="text-xs text-slate-500">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="mb-2 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <a href="#" className="mb-4 self-end text-xs font-semibold text-[#0b2545]">
        Forgot password?
      </a>

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
        SIGN IN
      </button>
    </form>
  );
}
