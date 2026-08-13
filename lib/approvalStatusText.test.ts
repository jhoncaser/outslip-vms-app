import { describe, it, expect } from "vitest";
import { formatApprovalStatusText, getApprovalStatusHue } from "./approvalStatusText";

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

describe("getApprovalStatusHue", () => {
  it("returns slate for unposted Open", () => {
    expect(getApprovalStatusHue("Open", null)).toBe("slate");
  });

  it("returns red for Open with a pending level (waiting to be approved)", () => {
    expect(getApprovalStatusHue("Open", 1)).toBe("red");
    expect(getApprovalStatusHue("Open", 2)).toBe("red");
    expect(getApprovalStatusHue("Open", 3)).toBe("red");
  });

  it("returns green for Approved, regardless of pending level", () => {
    expect(getApprovalStatusHue("Approved", null)).toBe("green");
    expect(getApprovalStatusHue("Approved", 1)).toBe("green");
  });

  it("returns red for Cancelled, regardless of pending level", () => {
    expect(getApprovalStatusHue("Cancelled", null)).toBe("red");
    expect(getApprovalStatusHue("Cancelled", 1)).toBe("red");
  });
});
