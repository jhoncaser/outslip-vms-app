import { describe, it, expect } from "vitest";
import { formatApprovalStatusText } from "./approvalStatusText";

describe("formatApprovalStatusText", () => {
  it("returns the status name unchanged when there is no pending level", () => {
    expect(formatApprovalStatusText("Open", null)).toBe("Open");
  });

  it("returns 'Waiting to be approved in 1st Level' when level 1 is pending", () => {
    expect(formatApprovalStatusText("Open", 1)).toBe("Waiting to be approved in 1st Level");
  });

  it("returns 'Waiting to be approved in 2nd Level' when level 2 is pending", () => {
    expect(formatApprovalStatusText("Open", 2)).toBe("Waiting to be approved in 2nd Level");
  });

  it("returns 'Waiting to be approved in 3rd Level' when level 3 is pending", () => {
    expect(formatApprovalStatusText("Open", 3)).toBe("Waiting to be approved in 3rd Level");
  });

  it("returns 'Approved' unchanged even if a pending level is somehow passed", () => {
    expect(formatApprovalStatusText("Approved", 1)).toBe("Approved");
  });

  it("returns 'Cancelled' unchanged regardless of pending level", () => {
    expect(formatApprovalStatusText("Cancelled", 1)).toBe("Cancelled");
    expect(formatApprovalStatusText("Cancelled", null)).toBe("Cancelled");
  });
});
