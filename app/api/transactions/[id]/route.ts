import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { postTransactionSchema } from "@/lib/validation/transaction";
import { getApprovalState } from "@/lib/transactionApproval";
import { emitTransactionChanged } from "@/lib/transactionEvents";

export async function PATCH(
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
    select: { creatorId: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.creatorId !== session.sub) {
    return NextResponse.json(
      { error: "Only the creator can post or unpost this transaction" },
      { status: 403 }
    );
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "This transaction is cancelled." },
      { status: 409 }
    );
  }

  const body = await request.json();
  const parsed = postTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Block unposting if any approval levels already exist
  if (parsed.data.posted === false) {
    const state = await getApprovalState(id);
    if (state.approvedLevels.length > 0) {
      return NextResponse.json(
        { error: "This transaction has already been approved at one or more levels. Ask the current approver to revise it instead of unposting." },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      postedAt: parsed.data.posted ? new Date() : null,
      revisionReason: parsed.data.posted ? null : undefined,
    },
    select: { postedAt: true },
  });

  if (parsed.data.posted) {
    const state = await getApprovalState(id);
    if (state.isFullyApproved) {
      const approvedStatus = await prisma.transactionStatus.findUniqueOrThrow({
        where: { name: "Approved" },
      });
      await prisma.transaction.update({ where: { id }, data: { statusId: approvedStatus.id } });
    }
  }

  emitTransactionChanged();
  return NextResponse.json(
    { postedAt: updated.postedAt ? updated.postedAt.toISOString() : null },
    { status: 200 }
  );
}

export async function DELETE(
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
    select: { creatorId: true, postedAt: true, status: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const isCreator = transaction.creatorId === session.sub;
  let isPendingApprover = false;

  if (transaction.postedAt !== null && transaction.status.name !== "Cancelled") {
    const state = await getApprovalState(id);
    const pendingApprover = state.chain.find((approver) => approver.level === state.pendingLevel);
    isPendingApprover = pendingApprover?.approverId === session.sub;
  }

  if (!isCreator && !isPendingApprover) {
    return NextResponse.json(
      { error: "Only the creator or the current approver can delete this transaction" },
      { status: 403 }
    );
  }

  if (transaction.postedAt !== null && !isPendingApprover) {
    return NextResponse.json(
      { error: "Unpost this transaction before deleting it." },
      { status: 409 }
    );
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Transaction is already cancelled." },
      { status: 409 }
    );
  }

  const cancelledStatus = await prisma.transactionStatus.findUniqueOrThrow({
    where: { name: "Cancelled" },
  });

  await prisma.transaction.update({
    where: { id },
    data: { statusId: cancelledStatus.id },
  });

  emitTransactionChanged();
  return new NextResponse(null, { status: 204 });
}
