export const ROLES = ["CREATOR", "APPROVER", "GUARD_PERSONNEL"] as const;

export type RoleValue = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleValue, string> = {
  CREATOR: "Creator",
  APPROVER: "Approver",
  GUARD_PERSONNEL: "Guard Personnel",
};
