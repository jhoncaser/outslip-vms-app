import { describe, it, expect } from "vitest";
import {
  canManageReferenceData,
  canProvisionUsers,
  canViewApprovals,
} from "./permissions";

describe("canManageReferenceData", () => {
  it("allows any Admin-department user regardless of role", () => {
    expect(
      canManageReferenceData({ department: "Admin", role: "CREATOR" })
    ).toBe(true);
    expect(
      canManageReferenceData({ department: "Admin", role: "GUARD_PERSONNEL" })
    ).toBe(true);
  });

  it("denies non-Admin-department users", () => {
    expect(
      canManageReferenceData({ department: "ICT", role: "FIRST_APPROVER" })
    ).toBe(false);
  });
});

describe("canProvisionUsers", () => {
  it("allows Admin department with an approver role", () => {
    expect(
      canProvisionUsers({ department: "Admin", role: "FIRST_APPROVER" })
    ).toBe(true);
    expect(
      canProvisionUsers({ department: "Admin", role: "SECOND_APPROVER" })
    ).toBe(true);
    expect(
      canProvisionUsers({ department: "Admin", role: "THIRD_APPROVER" })
    ).toBe(true);
  });

  it("denies Admin department with Creator or Guard Personnel role", () => {
    expect(canProvisionUsers({ department: "Admin", role: "CREATOR" })).toBe(
      false
    );
    expect(
      canProvisionUsers({ department: "Admin", role: "GUARD_PERSONNEL" })
    ).toBe(false);
  });

  it("denies non-Admin-department users even with an approver role", () => {
    expect(
      canProvisionUsers({ department: "ICT", role: "FIRST_APPROVER" })
    ).toBe(false);
  });
});

describe("canViewApprovals", () => {
  it("allows any department with an approver role", () => {
    expect(
      canViewApprovals({ department: "ICT", role: "FIRST_APPROVER" })
    ).toBe(true);
    expect(
      canViewApprovals({ department: "ICT", role: "SECOND_APPROVER" })
    ).toBe(true);
    expect(
      canViewApprovals({ department: "Admin", role: "THIRD_APPROVER" })
    ).toBe(true);
  });

  it("denies Creator or Guard Personnel roles regardless of department", () => {
    expect(
      canViewApprovals({ department: "Admin", role: "CREATOR" })
    ).toBe(false);
    expect(
      canViewApprovals({ department: "Admin", role: "GUARD_PERSONNEL" })
    ).toBe(false);
  });
});
