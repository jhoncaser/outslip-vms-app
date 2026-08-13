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

  const pendingApprover = state.chain.find((approver) => approver.level === state.pendingLevel);

  if (!pendingApprover || pendingApprover.approverId !== session.sub) {
    return NextResponse.json(
      { error: "Only the current level's approver can revise this transaction" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  await prisma.transaction.update({
    where: { id },
    data: { postedAt: null, revisionReason: reason },
  });

  emitTransactionChanged();
  return new NextResponse(null, { status: 204 });
}
