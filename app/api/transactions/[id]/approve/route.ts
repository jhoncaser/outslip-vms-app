import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getApprovalState } from "@/lib/transactionApproval";
import { emitTransactionChanged } from "@/lib/transactionEvents";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { postedAt: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.postedAt === null) {
    return NextResponse.json({ error: "This transaction is not posted." }, { status: 409 });
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json({ error: "This transaction is cancelled." }, { status: 409 });
  }

  const state = await getApprovalState(id);

  if (state.pendingLevel === null) {
    return NextResponse.json(
      { error: "This transaction is already fully approved." },
      { status: 409 }
    );
  }

  const pendingIndex = state.chain.findIndex((approver) => approver.level === state.pendingLevel);
  const pendingApprover = state.chain[pendingIndex];

  if (pendingApprover.approverId !== session.sub) {
    return NextResponse.json(
      { error: "Only the current level's approver can approve this transaction" },
      { status: 403 }
    );
  }

  const isLastLevel = pendingIndex === state.chain.length - 1;
  const nextPendingLevel = isLastLevel ? null : state.chain[pendingIndex + 1].level;

  let approvedStatusId: string | undefined;
  if (isLastLevel) {
    const approvedStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Approved" },
    });
    approvedStatusId = approvedStatus.id;
  }

  await prisma.$transaction([
    prisma.transactionApproval.create({
      data: { transactionId: id, level: pendingApprover.level, approverId: session.sub },
    }),
    ...(approvedStatusId
      ? [prisma.transaction.update({ where: { id }, data: { statusId: approvedStatusId } })]
      : []),
  ]);

  emitTransactionChanged();
  return NextResponse.json(
    { pendingLevel: nextPendingLevel, isFullyApproved: isLastLevel },
    { status: 200 }
  );
}
