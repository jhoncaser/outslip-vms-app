import type { Role } from "@prisma/client";

export interface AuthorizedUser {
  department: string;
  role: Role;
}

export function canManageReferenceData(user: AuthorizedUser): boolean {
  return user.department === "Admin";
}

export function canProvisionUsers(user: AuthorizedUser): boolean {
  return user.department === "Admin" && user.role === "APPROVER";
}

export function canViewApprovals(user: AuthorizedUser): boolean {
  return user.role === "APPROVER";
}
