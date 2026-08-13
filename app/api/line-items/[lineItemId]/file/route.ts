import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const lineItem = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileData: true, uploadFileType: true, uploadFileName: true },
  });

  if (!lineItem?.uploadFileData) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(lineItem.uploadFileData), {
    headers: {
      "Content-Type": lineItem.uploadFileType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${lineItem.uploadFileName ?? "file"}"`,
    },
  });
}
