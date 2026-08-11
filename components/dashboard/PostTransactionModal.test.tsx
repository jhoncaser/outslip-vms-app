import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PostTransactionModal } from "./PostTransactionModal";

describe("PostTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <PostTransactionModal
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

  it("calls onConfirm when Post is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both buttons while submitting and shows Posting…", () => {
    render(
      <PostTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <PostTransactionModal
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
      <PostTransactionModal
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
