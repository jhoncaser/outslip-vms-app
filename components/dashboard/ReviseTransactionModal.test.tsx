import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ReviseTransactionModal } from "./ReviseTransactionModal";

describe("ReviseTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /send back for revision/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not submit when the reason is blank", () => {
    const onConfirm = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /send for revision/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/reason is required/i);
  });

  it("calls onConfirm with the typed reason", () => {
    const onConfirm = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Planned Time doesn't match the actual shift start" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send for revision/i }));
    expect(onConfirm).toHaveBeenCalledWith("Planned Time doesn't match the actual shift start");
  });

  it("disables the textarea and both buttons while submitting", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/reason/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("shows a server error message when provided", () => {
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error="Something went wrong"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("does not dismiss on backdrop click or Escape", () => {
    const onCancel = vi.fn();
    render(
      <ReviseTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
