export const ROLES = [
  "CREATOR",
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
  "GUARD_PERSONNEL",
] as const;

export type RoleValue = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleValue, string> = {
  CREATOR: "Creator",
  FIRST_APPROVER: "1st Level Approver",
  SECOND_APPROVER: "2nd Level Approver",
  THIRD_APPROVER: "3rd Level Approver",
  GUARD_PERSONNEL: "Guard Personnel",
};
