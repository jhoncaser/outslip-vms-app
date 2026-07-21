import { prisma } from "@/lib/prisma";
import { TransactionsView } from "./TransactionsView";

export default async function OpenTransactionsPage() {
  const [transactions, matrixTypes] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: { name: "Open" } },
      orderBy: { createdAt: "desc" },
      include: {
        matrixType: { select: { name: true } },
        status: { select: { name: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.matrixType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const transactionRows = transactions.map((row) => ({
    id: row.id,
    transactionCode: row.transactionCode,
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
    createdBy: `${row.creator.firstName} ${row.creator.lastName}`,
    statusName: row.status.name,
    createdAt: row.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <TransactionsView transactions={transactionRows} matrixTypes={matrixTypes} />
      </div>
    </div>
  );
}
