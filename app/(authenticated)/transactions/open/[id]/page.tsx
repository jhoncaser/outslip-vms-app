import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { pageBackground } from "@/lib/deepForest";
import { findScopeMatchedApprovers } from "@/lib/matchApprovers";
import { TransactionDetailView, type LineItemRow, type ApproverRow } from "./TransactionDetailView";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const [transaction, users] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: {
        matrixType: { select: { name: true } },
        status: { select: { name: true } },
        creator: {
        select: {
          firstName: true,
          lastName: true,
          departmentId: true,
          businessUnitId: true,
          locationId: true,
        },
      },
        lineItems: {
          orderBy: { createdAt: "asc" },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                jobTitle: true,
                department: { select: { name: true } },
                businessUnit: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: { select: { name: true } },
        businessUnit: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";
  const isOwner = session?.sub === transaction.creatorId;

  const matchedApprovers = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const approvers: ApproverRow[] = matchedApprovers.map((row) => ({
    id: row.id,
    level: row.level,
    approverName: `${row.approverFirstName} ${row.approverLastName}`,
    initials: `${row.approverFirstName.charAt(0)}${row.approverLastName.charAt(0)}`.toUpperCase(),
  }));

  const detailFieldCandidates: { label: string; value: string }[] = [
    {
      label: "Planned Date",
      value: transaction.plannedDate
        ? transaction.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
    },
    {
      label: "Planned Time",
      value: transaction.plannedTime
        ? transaction.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
    },
    { label: "Reason", value: transaction.reason ?? "—" },
  ];

  const transactionDetail = {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    qrDataUrl: await QRCode.toDataURL(transaction.transactionCode, { width: 240, margin: 1 }),
    matrixTypeName: transaction.matrixType.name,
    statusName: transaction.status.name,
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    postedAt: transaction.postedAt ? transaction.postedAt.toISOString() : null,
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };

  const lineItems: LineItemRow[] = transaction.lineItems.map((item) => ({
    id: item.id,
    variant: isVisitorPass ? "visitor-pass" : "employee",
    visitorName: item.visitorName ?? "",
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    contactNumber: item.contactNumber ?? "",
    emailAddress: item.emailAddress ?? "",
    transportType: item.transportType ?? "",
    plateNo: item.plateNo ?? "",
    uploadFileName: item.uploadFileName ?? "",
    hasFile: Boolean(item.uploadFileUrl),
    employeeType: item.employeeType ?? "",
    employeeId: item.employeeId ?? "",
    employeeName: item.employee
      ? `${item.employee.firstName} ${item.employee.lastName}`
      : (item.name ?? ""),
    jobPosition: item.employee?.jobTitle ?? "—",
    department: item.employee?.department.name ?? "—",
    businessUnit: item.employee?.businessUnit.name ?? "—",
    remarks: item.remarks ?? "",
  }));

  const employees = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    jobPosition: user.jobTitle,
    department: user.department.name,
    businessUnit: user.businessUnit.name,
  }));

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
          approvers={approvers}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
