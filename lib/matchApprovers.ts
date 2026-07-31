import { prisma } from "@/lib/prisma";

export type ScopeMatchedApprover = {
  id: string;
  level: number;
  approverFirstName: string;
  approverLastName: string;
};

export async function findScopeMatchedApprovers(params: {
  isVisitorPass: boolean;
  matrixTypeId: string;
  departmentId: string | null;
  businessUnitId: string | null;
  locationId: string | null;
}): Promise<ScopeMatchedApprover[]> {
  const { isVisitorPass, matrixTypeId, departmentId, businessUnitId, locationId } = params;

  if (!isVisitorPass || !departmentId || !businessUnitId || !locationId) {
    return [];
  }

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
    approverFirstName: row.approver.firstName,
    approverLastName: row.approver.lastName,
  }));
}
