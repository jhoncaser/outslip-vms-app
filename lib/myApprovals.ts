import { prisma } from "@/lib/prisma";
import { getApprovalState } from "@/lib/transactionApproval";

export async function findPendingApprovalTransactionIds(
  approverId: string
): Promise<string[]> {
  const candidates = await prisma.transaction.findMany({
    where: { postedAt: { not: null }, status: { name: "Open" } },
    select: { id: true },
  });

  const pendingIds: string[] = [];
  for (const candidate of candidates) {
    const state = await getApprovalState(candidate.id);
    if (state.pendingLevel === null) continue;

    const pendingApprover = state.chain.find(
      (approver) => approver.level === state.pendingLevel
    );
    if (pendingApprover?.approverId === approverId) {
      pendingIds.push(candidate.id);
    }
  }

  return pendingIds;
}
