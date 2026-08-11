import { prisma } from "@/lib/prisma";
import { findScopeMatchedApprovers, type ScopeMatchedApprover } from "@/lib/matchApprovers";

export type ApprovalState = {
  chain: ScopeMatchedApprover[];
  approvedLevels: number[];
  pendingLevel: number | null;
  isFullyApproved: boolean;
};

export async function getApprovalState(transactionId: string): Promise<ApprovalState> {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    select: {
      matrixTypeId: true,
      creator: { select: { departmentId: true, businessUnitId: true, locationId: true } },
    },
  });

  const chain = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const approvals = await prisma.transactionApproval.findMany({
    where: { transactionId },
    select: { level: true },
  });
  const approvedLevels = approvals.map((approval) => approval.level).sort((a, b) => a - b);

  const pendingChainEntry = chain.find((approver) => !approvedLevels.includes(approver.level));
  const pendingLevel = pendingChainEntry ? pendingChainEntry.level : null;

  return { chain, approvedLevels, pendingLevel, isFullyApproved: pendingLevel === null };
}
