import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordForm } from "./ChangePasswordForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a confirmation toast, then redirects to /dashboard after a successful change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/password updated!/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));

    vi.useRealTimers();
  });

  it("shows an error when the server rejects the change", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Passwords do not match" }),
    });

    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
  });
});
