import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    testTimeout: 20000,
    // .claude/worktrees/ holds full checkouts of this repo; scanning them
    // runs duplicate suites concurrently against the same live database.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
