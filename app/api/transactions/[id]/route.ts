import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { postTransactionSchema } from "@/lib/validation/transaction";

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
    select: { creatorId: true },
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

  const body = await request.json();
  const parsed = postTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { postedAt: parsed.data.posted ? new Date() : null },
    select: { postedAt: true },
  });

  return NextResponse.json(
    { postedAt: updated.postedAt ? updated.postedAt.toISOString() : null },
    { status: 200 }
  );
}
