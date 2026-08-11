import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ApproveTransactionModal } from "./ApproveTransactionModal";

describe("ApproveTransactionModal", () => {
  it("shows the transaction code and type", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: /approve this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Halfday")).toBeInTheDocument();
  });

  it("shows next-level copy when not the final level", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/moves the transaction to the next level/i)).toBeInTheDocument();
  });

  it("shows final-approval copy when it is the final level", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={true}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/this is the final approval/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm when Approve is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both buttons while submitting and shows Approving…", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
        submitting={true}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /approving/i })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
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
      <ApproveTransactionModal
        transactionCode="OT-001"
        matrixTypeName="Halfday"
        isFinalLevel={false}
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
