"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Theme = "LIGHT" | "DARK";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeShell");
  }
  return context;
}

export function ThemeShell({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={theme === "DARK" ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}
