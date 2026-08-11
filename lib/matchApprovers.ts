import { prisma } from "@/lib/prisma";

export type ScopeMatchedApprover = {
  id: string;
  level: number;
  approverId: string;
  approverFirstName: string;
  approverLastName: string;
};

export async function findScopeMatchedApprovers(params: {
  matrixTypeId: string;
  departmentId: string;
  businessUnitId: string;
  locationId: string;
}): Promise<ScopeMatchedApprover[]> {
  const { matrixTypeId, departmentId, businessUnitId, locationId } = params;

  const rows = await prisma.matrixTypeApprover.findMany({
    where: {
      matrixTypeId,
      departmentId,
      businessUnitId,
      locationId,
    },
    include: { approver: { select: { firstName: true, lastName: true } } },
    orderBy: { level: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    level: row.level,
    approverId: row.approverId,
    approverFirstName: row.approver.firstName,
    approverLastName: row.approver.lastName,
  }));
}
