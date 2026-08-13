import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { pageBackground } from "@/lib/deepForest";
import { findScopeMatchedApprovers } from "@/lib/matchApprovers";
import { getApprovalState } from "@/lib/transactionApproval";
import { formatApprovalStatusText, getApprovalStatusHue } from "@/lib/approvalStatusText";
import { formatApprovalDuration } from "@/lib/approvalDuration";
import {
  TransactionDetailView,
  type LineItemRow,
  type ApproverRow,
} from "../../open/[id]/TransactionDetailView";

function formatDecidedAt(date: Date): string {
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

export default async function MyApprovalTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canViewApprovals(session)) {
    redirect("/dashboard");
  }

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
          omit: { uploadFileData: true },
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
        approvals: { select: { level: true, decidedAt: true } },
        _count: { select: { approvals: true } },
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
  const isOwner = session.sub === transaction.creatorId;

  const matchedApprovers = await findScopeMatchedApprovers({
    matrixTypeId: transaction.matrixTypeId,
    departmentId: transaction.creator.departmentId,
    businessUnitId: transaction.creator.businessUnitId,
    locationId: transaction.creator.locationId,
  });

  const decidedAtByLevel = new Map(
    transaction.approvals.map((approval) => [approval.level, approval.decidedAt])
  );

  const approvers: ApproverRow[] = matchedApprovers.map((row, index) => {
    const decidedAt = decidedAtByLevel.get(row.level) ?? null;
    const previousDecidedAt =
      index === 0
        ? transaction.postedAt
        : (decidedAtByLevel.get(matchedApprovers[index - 1].level) ?? null);

    return {
      id: row.id,
      level: row.level,
      approverName: `${row.approverFirstName} ${row.approverLastName}`,
      initials: `${row.approverFirstName.charAt(0)}${row.approverLastName.charAt(0)}`.toUpperCase(),
      decidedAtLabel: decidedAt ? formatDecidedAt(decidedAt) : null,
      durationLabel:
        decidedAt && previousDecidedAt
          ? formatApprovalDuration(previousDecidedAt.getTime(), decidedAt.getTime())
          : null,
    };
  });

  const approvalState =
    transaction.postedAt !== null && transaction.status.name !== "Cancelled"
      ? await getApprovalState(id)
      : null;
  const pendingApprover = approvalState?.chain.find(
    (approver) => approver.level === approvalState.pendingLevel
  );
  const isPendingApprover = session.sub === pendingApprover?.approverId;
  const isFinalApprovalLevel =
    !!approvalState &&
    approvalState.chain[approvalState.chain.length - 1]?.level === approvalState.pendingLevel;

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
    statusDisplay: formatApprovalStatusText(
      transaction.status.name,
      approvalState?.pendingLevel ?? null
    ),
    statusHue: getApprovalStatusHue(transaction.status.name, approvalState?.pendingLevel ?? null),
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    postedAt: transaction.postedAt ? transaction.postedAt.toISOString() : null,
    revisionReason: transaction.revisionReason,
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
    hasFile: Boolean(item.uploadFileName),
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
          isPendingApprover={isPendingApprover}
          isFinalApprovalLevel={isFinalApprovalLevel}
          hasApprovals={transaction._count.approvals > 0}
          backHref="/transactions/my-approvals"
        />
      </div>
    </div>
  );
}
