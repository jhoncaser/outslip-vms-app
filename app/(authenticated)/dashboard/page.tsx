import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { findPendingApprovalTransactionIds } from "@/lib/myApprovals";
import { ModuleGrid } from "@/components/dashboard/ModuleGrid";
import { TransactionLiveUpdates } from "@/components/dashboard/TransactionLiveUpdates";
import { pageBackground } from "@/lib/deepForest";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const canSeeApprovals = session ? canViewApprovals(session) : false;

  const [openCount, approvedCount, canceledCount, myApprovalsCount] = await Promise.all([
    prisma.transaction.count({ where: { status: { name: "Open" } } }),
    prisma.transaction.count({ where: { status: { name: "Approved" } } }),
    prisma.transaction.count({ where: { status: { name: "Cancelled" } } }),
    canSeeApprovals && session
      ? findPendingApprovalTransactionIds(session.sub).then((ids) => ids.length)
      : Promise.resolve(0),
  ]);

  return (
    <div className={`relative flex flex-1 flex-col overflow-hidden ${pageBackground}`}>
      <TransactionLiveUpdates />
      <ModuleGrid
        canViewApprovals={canSeeApprovals}
        openCount={openCount}
        approvedCount={approvedCount}
        canceledCount={canceledCount}
        myApprovalsCount={myApprovalsCount}
      />
    </div>
  );
}
