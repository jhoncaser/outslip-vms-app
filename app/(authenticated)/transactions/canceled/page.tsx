import { cookies } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { pageBackground, headingText, mutedText } from "@/lib/deepForest";
import { TransactionsTable } from "../open/TransactionsView";

export default async function CanceledTransactionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const transactions = await prisma.transaction.findMany({
    where: { status: { name: "Cancelled" } },
    orderBy: { createdAt: "desc" },
    include: {
      matrixType: { select: { name: true } },
      status: { select: { name: true } },
      creator: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  });

  const transactionRows = await Promise.all(
    transactions.map(async (row) => ({
      id: row.id,
      transactionCode: row.transactionCode,
      qrDataUrl: await QRCode.toDataURL(row.transactionCode, {
        width: 240,
        margin: 1,
      }),
      matrixTypeName: row.matrixType.name,
      plannedDate: row.plannedDate
        ? row.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
      plannedTime: row.plannedTime
        ? row.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      returnTime: row.returnTime
        ? row.returnTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
      originBusinessUnit: row.originBusinessUnit ?? "—",
      enrouteBusinessUnits:
        row.enrouteBusinessUnits.length > 0 ? row.enrouteBusinessUnits.join(", ") : "—",
      reason: row.reason ?? "—",
      visitorType: row.visitorType ?? "—",
      personToMeet: row.personToMeet ?? "—",
      department: row.department?.name ?? "—",
      location: row.visitLocation ?? "—",
      transportType: row.transportType ?? "—",
      plateNo: row.plateNo ?? "—",
      createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
      statusName: row.status.name,
      statusDisplay: row.status.name,
      createdAt: row.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      canManagePosting: session?.sub === row.creatorId,
    }))
  );

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <div className="mb-4">
          <h1 className={`text-lg ${headingText}`}>Canceled Transaction</h1>
          <p className={`text-xs ${mutedText}`}>Historical record of cancelled requests</p>
        </div>
        <TransactionsTable rows={transactionRows} showActions={false} emptyMessage="No cancelled transactions yet." />
      </div>
    </div>
  );
}
