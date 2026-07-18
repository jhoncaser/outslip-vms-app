import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeShell } from "./ThemeShell";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("flips visually right away and persists via PATCH /api/user/theme", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ themePreference: "DARK" }),
    });

    render(
      <ThemeShell initialTheme="LIGHT">
        <ThemeToggle />
      </ThemeShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(
      screen.getByRole("button", { name: /dark/i })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/user/theme",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ theme: "DARK" }),
        })
      )
    );
  });

  it("keeps the flipped visual state even when the persist call fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error")
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ThemeShell initialTheme="LIGHT">
        <ThemeToggle />
      </ThemeShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(
      screen.getByRole("button", { name: /dark/i })
    ).toBeInTheDocument();
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    consoleErrorSpy.mockRestore();
  });
});
