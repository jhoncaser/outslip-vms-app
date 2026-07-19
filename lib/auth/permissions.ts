import type { Role } from "@prisma/client";

export interface AuthorizedUser {
  department: string;
  role: Role;
}

const PROVISIONING_ROLES: Role[] = [
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
];

export function canManageReferenceData(user: AuthorizedUser): boolean {
  return user.department === "Admin";
}

export function canProvisionUsers(user: AuthorizedUser): boolean {
  return (
    user.department === "Admin" && PROVISIONING_ROLES.includes(user.role)
  );
}

const APPROVER_ROLES: Role[] = [
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
];

export function canViewApprovals(user: AuthorizedUser): boolean {
  return APPROVER_ROLES.includes(user.role);
}
