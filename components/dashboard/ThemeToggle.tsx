"use client";

import { useTheme } from "./ThemeShell";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  async function toggle() {
    const next = theme === "DARK" ? "LIGHT" : "DARK";
    setTheme(next);

    try {
      const response = await fetch("/api/user/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!response.ok) {
        console.error("Failed to save theme preference:", response.status);
      }
    } catch (err) {
      console.error("Failed to save theme preference:", err);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-white/40 px-3 py-1 text-xs text-white"
    >
      {theme === "DARK" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}
