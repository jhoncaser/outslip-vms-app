import { describe, it, expect } from "vitest";
import { formatApprovalDuration } from "./approvalDuration";

describe("formatApprovalDuration", () => {
  it("formats sub-minute durations as 0M : SS", () => {
    expect(formatApprovalDuration(0, 43_000)).toBe("0M : 43S");
  });

  it("formats minute-scale durations as M : SS", () => {
    expect(formatApprovalDuration(0, 2 * 60_000 + 5_000)).toBe("2M : 5S");
  });

  it("formats hour-scale durations as H : MM, dropping seconds", () => {
    expect(formatApprovalDuration(0, 90 * 60_000)).toBe("1H : 30M");
  });

  it("formats day-scale durations as D : HH, dropping minutes/seconds", () => {
    expect(formatApprovalDuration(0, (2 * 24 + 3) * 3_600_000)).toBe("2D : 3H");
  });

  it("clamps a negative or zero span to 0M : 0S instead of going negative", () => {
    expect(formatApprovalDuration(10_000, 0)).toBe("0M : 0S");
    expect(formatApprovalDuration(5_000, 5_000)).toBe("0M : 0S");
  });
});
